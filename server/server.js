'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const Anthropic = require('@anthropic-ai/sdk');
const mammoth = require('mammoth');
const ExcelJS = require('exceljs');

const PORT = process.env.PORT || 8787;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB per file
const MAX_FILES = 15;

const METHODOLOGY_PATH = path.join(__dirname, '..', 'CREDIT_METHODOLOGY.md');
const SYSTEM_PROMPT = fs.readFileSync(METHODOLOGY_PATH, 'utf8');

const DEAL_TYPES = ['Development', 'Planning', 'Transition'];

const client = new Anthropic(); // resolves ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN from env

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
});

function extOf(filename) {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() : '';
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'object' && value.text !== undefined ? String(value.text) : String(value);
  return /[,"\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

async function xlsxToText(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook.worksheets
    .map((sheet) => {
      const rows = [];
      sheet.eachRow((row) => {
        rows.push(row.values.slice(1).map(csvCell).join(','));
      });
      return `[Sheet: ${sheet.name}]\n${rows.join('\n')}`;
    })
    .join('\n\n');
}

/**
 * Turns one uploaded file into Claude message content block(s), plus a
 * short label block so the model knows which file each block came from.
 * Returns { blocks, warning } — warning is set when extraction failed and
 * the file could not be included.
 */
async function fileToContentBlocks(file) {
  const ext = extOf(file.originalname);
  const label = { type: 'text', text: `--- FILE: ${file.originalname} ---` };

  try {
    if (ext === 'pdf') {
      return {
        blocks: [
          label,
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: file.buffer.toString('base64') },
          },
        ],
      };
    }

    if (['png', 'jpg', 'jpeg'].includes(ext)) {
      const mediaType = ext === 'png' ? 'image/png' : 'image/jpeg';
      return {
        blocks: [
          label,
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: file.buffer.toString('base64') } },
        ],
      };
    }

    if (ext === 'docx') {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      return { blocks: [label, { type: 'text', text: result.value }] };
    }

    if (ext === 'doc') {
      return { blocks: [], warning: `${file.originalname}: legacy .doc format isn't supported — please re-save as .docx or .pdf.` };
    }

    if (ext === 'xlsx') {
      const text = await xlsxToText(file.buffer);
      return { blocks: [label, { type: 'text', text }] };
    }

    if (['txt', 'csv'].includes(ext)) {
      return { blocks: [label, { type: 'text', text: file.buffer.toString('utf8') }] };
    }

    if (ext === 'xls') {
      return { blocks: [], warning: `${file.originalname}: legacy .xls format isn't supported — please re-save as .xlsx or .csv.` };
    }

    return { blocks: [], warning: `${file.originalname}: unsupported file type ".${ext}" — not sent to the methodology agent.` };
  } catch (err) {
    return { blocks: [], warning: `${file.originalname}: could not extract content (${err.message}).` };
  }
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  return JSON.parse(candidate.trim());
}

app.post('/api/score-deal', upload.array('files', MAX_FILES), async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded.' });
    }

    const dealName = (req.body.dealName || '').trim() || files[0].originalname.replace(/\.[^./]+$/, '');
    const statedDealType = DEAL_TYPES.includes(req.body.dealType) ? req.body.dealType : null;

    const fileResults = await Promise.all(files.map(fileToContentBlocks));
    const warnings = fileResults.map((r) => r.warning).filter(Boolean);
    const contentBlocks = fileResults.flatMap((r) => r.blocks);

    if (contentBlocks.length === 0) {
      return res.status(422).json({ error: 'None of the uploaded files could be read.', warnings });
    }

    const introText = [
      `Deal Name: ${dealName}`,
      statedDealType
        ? `User's stated loan type (their best guess — confirm it from the documents per §4): ${statedDealType}`
        : "User did not state a loan type — determine it from the documents per §4.",
      warnings.length ? `\nNote: some uploaded files could not be included:\n${warnings.join('\n')}` : '',
      `\nThe following ${contentBlocks.length ? files.length : 0} document(s) are provided below. Follow your instructions and respond with only the JSON object described in §6 — no markdown code fences, no commentary before or after it.`,
    ].filter(Boolean).join('\n');

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: introText }, ...contentBlocks],
        },
      ],
    });

    if (response.stop_reason === 'refusal') {
      return res.status(502).json({ error: 'The methodology agent declined to process this deal.', details: response.stop_details || null });
    }

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock) {
      return res.status(502).json({ error: 'The methodology agent returned no text output.' });
    }

    let agentOutput;
    try {
      agentOutput = extractJson(textBlock.text);
    } catch (err) {
      return res.status(502).json({
        error: 'The methodology agent\'s output was not valid JSON.',
        raw: textBlock.text,
      });
    }

    if (!agentOutput.dealType || !DEAL_TYPES.includes(agentOutput.dealType)) {
      return res.status(502).json({ error: 'The methodology agent did not return a valid dealType.', raw: agentOutput });
    }
    if (!agentOutput.answers || typeof agentOutput.answers !== 'object') {
      return res.status(502).json({ error: 'The methodology agent did not return an answers object.', raw: agentOutput });
    }

    return res.json({ ...agentOutput, dealName, warnings });
  } catch (err) {
    console.error(err);
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY is missing or invalid on the server.' });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'Rate limited by the Claude API — try again shortly.' });
    }
    if (err instanceof Anthropic.APIError) {
      return res.status(502).json({ error: `Claude API error: ${err.message}` });
    }
    if (typeof err.message === 'string' && err.message.includes('authentication method')) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server. Copy server/.env.example to server/.env and set it.' });
    }
    return res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, model: MODEL, hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

app.listen(PORT, () => {
  console.log(`TIDA methodology server listening on port ${PORT} (model: ${MODEL})`);
});

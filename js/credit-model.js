/*
 * TIDA Credit Checker — scoring model
 * Derived from "TIDA CREDIT CHECKER V01" rubric.
 * Every variable contributes a score between its own min/max; the deal's
 * final 0-100 score is the sum of applicable variable scores normalised
 * against the sum of applicable min/max bounds.
 */

const DEAL_TYPES = ['Development', 'Planning', 'Transition'];

const CATEGORIES = [
  { id: 'asset', name: 'Asset & Site Quality' },
  { id: 'capital', name: 'Capital Structure' },
  { id: 'exit', name: 'Exit Strategy' },
  { id: 'external', name: 'External Risk Factors' },
  { id: 'strategy', name: 'Strategy & Execution Capability' },
];

const ALL_TYPES = { Development: true, Planning: true, Transition: true };

// context fields are informational only and never contribute to the score
function ctx(id, category, label, options, applies) {
  return { id, category, label, type: 'context', options, applies: applies || ALL_TYPES, min: 0, max: 0 };
}

function sel(id, category, label, options, min, max, applies, help) {
  return { id, category, label, type: 'select', options, min, max, applies: applies || ALL_TYPES, help };
}

function num(id, category, label, unit, min, max, calc, applies, help) {
  return { id, category, label, type: 'number', unit, min, max, calc, applies: applies || ALL_TYPES, help };
}

const VARIABLES = [
  // ---- Asset & Site Quality ----
  ctx('assetType', 'asset', 'Asset Type', ['Residential', 'Commercial', 'Mixed-use', 'Land']),
  ctx('subAssetType', 'asset', 'Sub-Asset Type', ['Residential', 'Commercial', 'Office', 'Industrial', 'Retail', 'Leisure']),
  sel('assetPlan', 'asset', 'Asset Plan Fit (use vs. location)', [
    { label: 'Poor fit for location', score: -30 },
    { label: 'Below average fit', score: -15 },
    { label: 'Neutral fit', score: 0 },
    { label: 'Good fit', score: 15 },
    { label: 'Excellent fit', score: 30 },
  ], -30, 30),
  ctx('titleType', 'asset', 'Title Type', ['Freehold', 'Leasehold']),
  num('leaseLength', 'asset', 'Lease Length Remaining (years, if leasehold)', 'years', -30, 0,
    (v) => (v >= 30 ? 0 : Math.max(-30, -(30 - v))),
    ALL_TYPES, 'Only penalised if under 30 years remaining.'),
  num('groundRent', 'asset', 'Ground Rent & Service Charges (£/yr)', '£', -30, 0,
    (v) => (v <= 2000 ? 0 : v <= 5000 ? -10 : v <= 10000 ? -22 : -30)),
  sel('planningStatus', 'asset', 'Planning Status', [
    { label: 'Permitted Development', score: 0 },
    { label: 'Full Permission', score: -5 },
    { label: 'Outline Permission', score: -10 },
    { label: 'Allocated', score: -15 },
    { label: 'Pre-allocation', score: -22.5 },
    { label: 'Pre-application', score: -30 },
  ], -30, 0, { Development: true, Planning: true, Transition: false }),
  sel('planningDetails', 'asset', 'Planning Permission Details', [
    { label: 'Full planning granted for scheme', score: 0 },
    { label: 'Mixed-use with partial approvals', score: -7.5 },
    { label: 'Non-traditional / co-living scheme proposal', score: -15 },
    { label: 'Under appeal', score: -22.5 },
    { label: 'Scheme under design / no submission', score: -30 },
  ], -30, 0, { Development: true, Planning: true, Transition: false }),
  sel('environmentalRisk', 'asset', 'Environmental Risk', [
    { label: 'Very Low', score: 0 }, { label: 'Low', score: -7.5 }, { label: 'Medium', score: -15 },
    { label: 'High', score: -22.5 }, { label: 'Very High', score: -30 },
  ], -30, 0, { Development: true, Planning: true, Transition: false }),
  sel('floodRisk', 'asset', 'Flood Risk', [
    { label: 'Very Low', score: 0 }, { label: 'Low', score: -5 }, { label: 'Medium', score: -10 },
    { label: 'High', score: -20 }, { label: 'Very High', score: -30 },
  ], -30, 0),
  sel('contaminationRisk', 'asset', 'Contamination Risk', [
    { label: 'Very Low', score: 0 }, { label: 'Low', score: -7.5 }, { label: 'Medium', score: -15 },
    { label: 'High', score: -22.5 }, { label: 'Very High', score: -30 },
  ], -30, 0, { Development: true, Planning: true, Transition: false }),
  sel('ecologicalSurveys', 'asset', 'Ecological Surveys', [
    { label: 'Completed — no ecological constraints', score: 0 },
    { label: 'Completed — minor findings (low impact species)', score: -7.5 },
    { label: 'Completed — protected species identified', score: -15 },
    { label: 'Recommended / not yet undertaken', score: -22.5 },
    { label: 'Known constraints / designated natural area', score: -30 },
  ], -30, 0, { Development: true, Planning: true, Transition: false }),
  sel('locationAnalysis', 'asset', 'Location Analysis', [
    { label: 'Prime area / affluent', score: 0 }, { label: 'Medium', score: -7.5 },
    { label: 'Average demand / mixed-use zone', score: -15 }, { label: 'Peripheral / secondary', score: -22.5 },
    { label: 'Declining area / high vacancy', score: -30 },
  ], -30, 0),
  sel('transportAccessibility', 'asset', 'Transport Accessibility', [
    { label: 'Excellent — major transport hub', score: 0 }, { label: 'Good — well-served', score: -7.5 },
    { label: 'Moderate / limited', score: -15 }, { label: 'Poor / infrequent service', score: -22.5 },
    { label: 'Isolated / no access', score: -30 },
  ], -30, 0),
  sel('infrastructureQuality', 'asset', 'Infrastructure Quality', [
    { label: 'Excellent / newly developed', score: 0 }, { label: 'Good / well-maintained', score: -7.5 },
    { label: 'Adequate / average', score: -15 }, { label: 'Limited / aged', score: -22.5 },
    { label: 'Poor / inadequate', score: -30 },
  ], -30, 0),
  sel('buildingCondition', 'asset', 'Building Condition', [
    { label: 'Newly built / fully refurbished', score: 0 }, { label: 'Partially refurbished / well-maintained', score: -7.5 },
    { label: 'Average / dated but functional', score: -15 }, { label: 'Poor / requires refurbishment', score: -22.5 },
    { label: 'Structural issues / not fit for use', score: -30 },
  ], -30, 0),
  sel('epcRating', 'asset', 'EPC Rating', [
    { label: 'A', score: 0 }, { label: 'B', score: -5 }, { label: 'C', score: -10 }, { label: 'D', score: -15 },
    { label: 'E', score: -22.5 }, { label: 'F', score: -27.5 }, { label: 'G', score: -30 },
  ], -30, 0),
  sel('fireSafety', 'asset', 'Fire Safety Compliance', [
    { label: 'Fully compliant / recently certified', score: 0 }, { label: 'Minor issues / under review', score: -7.5 },
    { label: 'Requires partial upgrades', score: -15 }, { label: 'Non-compliant / serious issues', score: -30 },
  ], -30, 0),
  sel('physicalState', 'asset', 'Physical State', [
    { label: 'Excellent / pristine', score: 0 }, { label: 'Good / well-maintained', score: -7.5 },
    { label: 'Mixed condition', score: -15 }, { label: 'Worn / dated', score: -22.5 },
    { label: 'Poor / damaged', score: -30 },
  ], -30, 0),
  num('valuationVsMarket', 'asset', 'Valuation (% of market average £/sqft)', '%', -30, 0,
    (v) => (v <= 75 ? 0 : v <= 90 ? -10 : v <= 110 ? -15 : v <= 125 ? -22.5 : -30)),
  sel('valuationMethod', 'asset', 'Valuation Method', [
    { label: 'Red Book', score: 0 }, { label: 'Market Value', score: -7.5 },
    { label: 'Income Approach', score: -15 }, { label: 'Cost Approach', score: -25 },
  ], -30, 0),
  num('yieldCalc', 'asset', 'Yield (%)', '%', -30, 0,
    (v) => (v >= 6 ? 0 : v >= 5 ? -7.5 : v >= 4 ? -15 : v >= 3 ? -22.5 : -30)),
  num('occupancy', 'asset', 'Occupancy Rate (%)', '%', -30, 0,
    (v) => (v >= 95 ? 0 : v >= 85 ? -7.5 : v >= 70 ? -15 : v >= 50 ? -22.5 : -30),
    { Development: false, Planning: true, Transition: true }),
  num('wault', 'asset', 'Lease Terms — WAULT (years)', 'years', -30, 0,
    (v) => (v >= 8 ? 0 : v >= 5 ? -7.5 : v >= 3 ? -15 : v >= 1 ? -22.5 : -30),
    { Development: false, Planning: true, Transition: true }),
  num('rentalIncome', 'asset', 'Rental Income (£/yr)', '£', -30, 0,
    (v) => (v >= 2000000 ? 0 : v >= 1500000 ? -7.5 : v >= 1000000 ? -15 : v >= 500000 ? -22.5 : -30),
    { Development: false, Planning: true, Transition: true }),
  num('vacancyRate', 'asset', 'Vacancy Rate (%)', '%', -30, 0,
    (v) => (v <= 5 ? 0 : v <= 15 ? -7.5 : v <= 30 ? -15 : v <= 50 ? -22.5 : -30),
    { Development: false, Planning: true, Transition: true }),
  sel('marketDynamics', 'asset', 'Market Dynamics', [
    { label: 'Strong demand / undersupplied', score: 0 }, { label: 'Balanced / stable', score: -7.5 },
    { label: 'Softening / moderate demand', score: -15 }, { label: 'Limited demand / weak activity', score: -22.5 },
    { label: 'Declining market / oversupplied', score: -30 },
  ], -30, 0),
  sel('economicIndicators', 'asset', 'Economic Indicators', [
    { label: 'Strong growth / positive outlook', score: 0 }, { label: 'Stable / balanced', score: -7.5 },
    { label: 'Slowing / modest decline', score: -15 }, { label: 'Recessionary signs / stagnation', score: -22.5 },
    { label: 'Crisis / high inflation + low activity', score: -30 },
  ], -30, 0),
  sel('utilityAccess', 'asset', 'Utility & Access', [
    { label: 'Fully serviced / excellent', score: 0 }, { label: 'Good access / standard connections', score: -7.5 },
    { label: 'Partial access / infrastructure nearby', score: -15 }, { label: 'Limited / unreliable utilities', score: -22.5 },
    { label: 'Off-grid / no access to basic utilities', score: -30 },
  ], -30, 0),
  sel('easements', 'asset', 'Easements & Restrictions', [
    { label: 'None / no known restrictions', score: 0 }, { label: 'Minor easements / standard right of way', score: -7.5 },
    { label: 'Third-party agreements (e.g. railway)', score: -15 }, { label: 'Development limitations / protected rights', score: -22.5 },
    { label: 'Prohibited uses / critical servitudes', score: -30 },
  ], -30, 0),

  // ---- Capital Structure ----
  num('ltv', 'capital', 'Loan-to-Value (%)', '%', -30, 0,
    (v) => (v <= 40 ? 0 : v <= 55 ? -7.5 : v <= 70 ? -15 : v <= 85 ? -22.5 : -30)),
  num('ltc', 'capital', 'Loan-to-Cost (%)', '%', -30, 0,
    (v) => (v <= 40 ? 0 : v <= 55 ? -7.5 : v <= 70 ? -15 : v <= 85 ? -22.5 : -30),
    { Development: true, Planning: true, Transition: false }),
  num('equityInjection', 'capital', 'Equity Injection (% of total cost)', '%', -30, 0,
    (v) => (v >= 50 ? 0 : v >= 35 ? -7.5 : v >= 20 ? -15 : v >= 10 ? -22.5 : -30)),
  sel('securityRanking', 'capital', 'Security Ranking', [
    { label: 'First charge', score: 0 }, { label: 'Second charge', score: -15 }, { label: 'Subordinate charge', score: -30 },
  ], -30, 0),
  sel('sourceVerification', 'capital', 'Source Verification', [
    { label: 'Fully verified', score: 0 }, { label: 'Partially verified', score: -10 },
    { label: 'Declared but not verified', score: -20 }, { label: 'Unverifiable / unknown', score: -30 },
  ], -30, 0, { Development: true, Planning: true, Transition: false }),
  sel('debtLayering', 'capital', 'Debt Layering', [
    { label: 'Simple (only senior debt)', score: 0 }, { label: 'Moderate (senior + mezzanine)', score: -10 },
    { label: 'Complex (3+ layers incl. bridge/junior/preferred)', score: -20 },
  ], -20, 0),
  sel('seniorDebtTerms', 'capital', 'Senior Debt Terms', [
    { label: 'Favourable (long-term, fixed, flexible covenants)', score: 0 },
    { label: 'Standard market terms', score: -5 },
    { label: 'Somewhat aggressive (short maturity, variable, tight covenants)', score: -10 },
    { label: 'Aggressive / highly restrictive', score: -20 },
  ], -20, 0),
  sel('mezzanineTerms', 'capital', 'Mezzanine Debt Terms', [
    { label: 'Favourable (subordinated, long-term, low interest)', score: 0 },
    { label: 'Standard market terms', score: -5 },
    { label: 'Aggressive (high interest, tight covenants)', score: -10 },
    { label: 'Highly aggressive / opaque', score: -20 },
  ], -20, 0),
  sel('equityFundingTerms', 'capital', 'Equity Funding Terms', [
    { label: 'Fully committed, long-term, flexible exit', score: 0 },
    { label: 'Committed capital, exit aligned with plan', score: -5 },
    { label: 'Conditional commitment / early exit expected', score: -10 },
    { label: 'Aggressive terms (forced exit, control issues)', score: -20 },
  ], -20, 0),
  sel('repaymentProfile', 'capital', 'Repayment Profile', [
    { label: 'Cash-flow aligned, back-ended, flexible', score: 0 },
    { label: 'Standard amortisation with grace period', score: -5 },
    { label: 'Front-loaded / tight repayment window', score: -10 },
    { label: 'Rigid / compressed schedule', score: -20 },
  ], -20, 0),
  num('icr', 'capital', 'Interest Coverage Ratio (ICR)', 'x', -20, 0,
    (v) => (v >= 2 ? 0 : v >= 1.5 ? -5 : v >= 1.2 ? -10 : v >= 1.0 ? -15 : -20)),
  num('dscr', 'capital', 'Debt Service Coverage Ratio (DSCR)', 'x', -20, 0,
    (v) => (v >= 1.5 ? 0 : v >= 1.2 ? -5 : v >= 1.0 ? -10 : v >= 0.9 ? -15 : -20)),
  num('contingencyReserve', 'capital', 'Contingency Reserve (% of budget)', '%', -20, 0,
    (v) => (v >= 10 ? 0 : v >= 5 ? -5 : v >= 2 ? -10 : v > 0 ? -15 : -20),
    { Development: true, Planning: true, Transition: false }),
  sel('externalGuarantees', 'capital', 'External Guarantees', [
    { label: 'Unconditional guarantee from reputable institution', score: 0 },
    { label: 'Conditional guarantee with coverage limits', score: -5 },
    { label: 'Letter of intent / non-binding support', score: -10 },
    { label: 'Guarantee from weak / unknown entity', score: -15 },
    { label: 'No external guarantees', score: -20 },
  ], -20, 0),
  num('guaranteeCoverage', 'capital', 'Guarantee Coverage (%)', '%', -20, 0,
    (v) => (v >= 100 ? 0 : v >= 75 ? -5 : v >= 50 ? -10 : v >= 25 ? -15 : -20)),
  num('capitalStackTransparency', 'capital', 'Capital Stack Transparency (%)', '%', -20, 0,
    (v) => (v >= 100 ? 0 : v >= 75 ? -5 : v >= 50 ? -10 : v >= 25 ? -15 : -20)),

  // ---- Exit Strategy ----
  sel('exitType', 'exit', 'Exit Type', [
    { label: 'Sale — flexible timeline, proven demand', score: 0 },
    { label: 'Refinance — pre-agreed terms / committed lenders', score: -5 },
    { label: 'Staged drawdowns based on milestones', score: -10 },
    { label: 'Speculative sale / uncommitted refinance', score: -20 },
  ], -20, 0),
  sel('timingAlignment', 'exit', 'Timing Alignment', [
    { label: 'All milestones and funding aligned with delivery', score: 0 },
    { label: 'Minor timing gaps', score: -5 },
    { label: 'Key events misaligned (e.g. refinance before completion)', score: -10 },
    { label: 'Multiple misalignments / unrealistic expectations', score: -20 },
  ], -20, 0),
  sel('risksSensitivities', 'exit', 'Risks & Sensitivities Analysis', [
    { label: 'Key risks identified, mitigated, tested', score: 0 },
    { label: 'Most risks identified, partial mitigation', score: -5 },
    { label: 'Limited analysis / optimistic assumptions', score: -10 },
    { label: 'No risk mitigation or sensitivity testing', score: -20 },
  ], -20, 0),
  sel('contingencyPlanning', 'exit', 'Contingency Planning', [
    { label: 'Robust plan in place', score: 0 }, { label: 'Basic contingency identified', score: -5 },
    { label: 'Limited planning', score: -10 }, { label: 'No planning', score: -20 },
  ], -20, 0),
  sel('preSales', 'exit', 'Pre-sales / Commitments', [
    { label: 'Very High', score: 20 }, { label: 'High', score: 10 }, { label: 'Medium', score: 0 },
    { label: 'Low', score: -10 }, { label: 'Very Low', score: -20 },
  ], -20, 20, { Development: false, Planning: true, Transition: true }),
  sel('marketAbsorption', 'exit', 'Market Absorption', [
    { label: 'Rapidly Increasing', score: 10 }, { label: 'Increasing', score: 5 }, { label: 'Stable', score: 0 },
    { label: 'Decreasing', score: -10 }, { label: 'Rapidly Decreasing', score: -20 },
  ], -20, 10),
  sel('alternativeExits', 'exit', 'Alternative Exits', [
    { label: 'Multiple exit options', score: 0 }, { label: 'Limited exit options', score: -10 }, { label: 'No clear exit', score: -20 },
  ], -20, 0),
  sel('financialProjections', 'exit', 'Financial Projections Confidence', [
    { label: 'Very High', score: 20 }, { label: 'High', score: 10 }, { label: 'Medium', score: 0 },
    { label: 'Low', score: -10 }, { label: 'Very Low', score: -20 },
  ], -20, 20),

  // ---- External Risk Factors ----
  sel('politicalStability', 'external', 'Political Stability', [
    { label: 'Very Stable', score: 0 }, { label: 'Stable', score: -5 }, { label: 'Moderately Stable', score: -10 },
    { label: 'Unstable', score: -15 }, { label: 'Very Unstable', score: -20 },
  ], -20, 0),
  sel('localAuthorityRisk', 'external', 'Local Authority Risk', [
    { label: 'Very Low', score: 0 }, { label: 'Low', score: -5 }, { label: 'Medium', score: -10 },
    { label: 'High', score: -15 }, { label: 'Very High', score: -20 },
  ], -20, 0),
  sel('legalRisks', 'external', 'Legal Risks', [
    { label: 'Very Low', score: 0 }, { label: 'Low', score: -5 }, { label: 'Medium', score: -10 },
    { label: 'High', score: -15 }, { label: 'Very High', score: -20 },
  ], -20, 0),
  sel('demandTrends', 'external', 'Demand Trends', [
    { label: 'Rapidly Increasing', score: 10 }, { label: 'Increasing', score: 5 }, { label: 'Stable', score: 0 },
    { label: 'Decreasing', score: -10 }, { label: 'Rapidly Decreasing', score: -20 },
  ], -20, 10),
  sel('competitiveLandscape', 'external', 'Competitive Landscape', [
    { label: 'No Competition', score: 0 }, { label: 'Low Competition', score: -5 }, { label: 'Average', score: -10 },
    { label: 'Moderately Competitive', score: -15 }, { label: 'Highly Competitive', score: -20 },
  ], -20, 0),
  sel('technologicalChanges', 'external', 'Technological Change Impact', [
    { label: 'No Impact', score: 0 }, { label: 'Low Impact', score: -5 }, { label: 'Moderate Impact', score: -10 },
    { label: 'High Impact', score: -15 }, { label: 'Very High Impact', score: -20 },
  ], -20, 0),
  sel('regulatoryEnvironment', 'external', 'Regulatory Environment', [
    { label: 'Very Strong', score: 0 }, { label: 'Strong', score: -5 }, { label: 'Moderate', score: -10 },
    { label: 'Weak', score: -15 }, { label: 'Very Weak', score: -20 },
  ], -20, 0),
  sel('constructionMarketTrends', 'external', 'Construction Market Trends', [
    { label: 'Excellent', score: 0 }, { label: 'Good', score: -5 }, { label: 'Adequate', score: -10 },
    { label: 'Poor', score: -15 }, { label: 'Very Poor', score: -20 },
  ], -20, 0, { Development: true, Planning: true, Transition: false }),
  sel('environmentalCompliance', 'external', 'Environmental Compliance', [
    { label: 'Very High', score: 20 }, { label: 'High', score: 10 }, { label: 'Medium', score: 0 },
    { label: 'Low', score: -10 }, { label: 'Very Low', score: -20 },
  ], -20, 20),

  // ---- Strategy & Execution Capability ----
  sel('teamExpertise', 'strategy', 'Team Expertise', [
    { label: 'Very High', score: 20 }, { label: 'High', score: 10 }, { label: 'Medium', score: 0 },
    { label: 'Low', score: -10 }, { label: 'Very Low', score: -20 },
  ], -20, 20),
  sel('contractorRelationships', 'strategy', 'Contractor Relationships', [
    { label: 'Very Strong', score: 20 }, { label: 'Strong', score: 10 }, { label: 'Moderate', score: 0 },
    { label: 'Weak', score: -10 }, { label: 'Very Weak', score: -20 },
  ], -20, 20, { Development: true, Planning: false, Transition: false }, 'Only relevant for Development loans.'),
  sel('costManagement', 'strategy', 'Cost Management', [
    { label: 'Excellent', score: 0 }, { label: 'Good', score: -5 }, { label: 'Adequate', score: -10 },
    { label: 'Poor', score: -15 }, { label: 'Very Poor', score: -20 },
  ], -20, 0),
  sel('timelinessMilestones', 'strategy', 'Timeliness & Milestones', [
    { label: 'Always Met', score: 0 }, { label: 'Consistently Met', score: -5 }, { label: 'Occasionally Missed', score: -10 },
    { label: 'Frequently Missed', score: -15 }, { label: 'Always Missed', score: -20 },
  ], -20, 0),
  sel('regulatoryCompliance', 'strategy', 'Regulatory Compliance', [
    { label: 'Excellent', score: 0 }, { label: 'Good', score: -5 }, { label: 'Adequate', score: -10 },
    { label: 'Poor', score: -15 }, { label: 'Very Poor', score: -20 },
  ], -20, 0),
  sel('developerTrackRecord', 'strategy', 'Developer Track Record', [
    { label: 'Extensive, no defaults, 5+ successful projects', score: 0 },
    { label: 'Good, 2-5 relevant completions, minor delays only', score: -5 },
    { label: 'Limited, 1-2 small projects completed', score: -10 },
    { label: 'Minimal, no completions yet', score: -15 },
    { label: 'Negative, failed or defaulted projects', score: -20 },
  ], -20, 0, { Development: true, Planning: true, Transition: false }),
  sel('insuranceCoverage', 'strategy', 'Insurance Coverage', [
    { label: 'Comprehensive and active', score: 0 }, { label: 'Standard coverage', score: -5 },
    { label: 'Partial or outdated', score: -10 }, { label: 'Insufficient or expired', score: -15 },
    { label: 'No insurance', score: -20 },
  ], -20, 0),
  sel('documentationQuality', 'strategy', 'Documentation Quality', [
    { label: 'Well-organised, complete, audited', score: 0 },
    { label: 'Mostly complete, minor gaps', score: -5 },
    { label: 'Partial or inconsistent', score: -10 },
    { label: 'Disorganised or outdated', score: -15 },
    { label: 'Minimal or unavailable', score: -20 },
  ], -20, 0),
];

function appliesTo(variable, dealType) {
  return !!variable.applies[dealType];
}

function scoreOf(variable, value) {
  if (variable.type === 'context') return 0;
  if (value === undefined || value === null || value === '') return null;
  if (variable.type === 'select') {
    const opt = variable.options.find((o) => o.label === value);
    return opt ? opt.score : null;
  }
  if (variable.type === 'number') {
    const n = Number(value);
    if (Number.isNaN(n)) return null;
    return variable.calc(n);
  }
  return null;
}

// answers: { [variableId]: value }
function calculateScore(dealType, answers) {
  const scored = VARIABLES.filter((v) => v.type !== 'context' && appliesTo(v, dealType));

  let totalMin = 0;
  let totalMax = 0;
  let raw = 0;
  let answered = 0;
  const byCategory = {};
  CATEGORIES.forEach((c) => { byCategory[c.id] = { min: 0, max: 0, raw: 0, answered: 0, total: 0 }; });

  scored.forEach((v) => {
    byCategory[v.category].total += 1;

    const s = scoreOf(v, answers[v.id]);
    if (s !== null) {
      raw += s;
      answered += 1;
      totalMin += v.min;
      totalMax += v.max;
      byCategory[v.category].raw += s;
      byCategory[v.category].answered += 1;
      byCategory[v.category].min += v.min;
      byCategory[v.category].max += v.max;
    }
  });

  const range = totalMax - totalMin;
  const overall = range > 0 ? Math.round(((raw - totalMin) / range) * 100) : 0;

  const categories = CATEGORIES.map((c) => {
    const b = byCategory[c.id];
    const catRange = b.max - b.min;
    const catScore = catRange > 0 ? Math.round(((b.raw - b.min) / catRange) * 100) : 0;
    return { id: c.id, name: c.name, score: catScore, answered: b.answered, total: b.total };
  });

  return {
    overall: Math.max(0, Math.min(100, overall)),
    answered,
    totalFields: scored.length,
    categories,
  };
}

function riskBand(score) {
  if (score >= 80) return { label: 'Strong', className: 'band-strong' };
  if (score >= 65) return { label: 'Good', className: 'band-good' };
  if (score >= 50) return { label: 'Moderate', className: 'band-moderate' };
  if (score >= 35) return { label: 'Weak', className: 'band-weak' };
  return { label: 'High Risk', className: 'band-high-risk' };
}

function fieldsForDealType(dealType) {
  return VARIABLES.filter((v) => appliesTo(v, dealType));
}

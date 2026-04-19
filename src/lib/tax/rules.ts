import type { CountryMetadata } from '$lib/types';

export const COUNTRY_RULES: CountryMetadata[] = [
  {
    code: 'JP',
    countryName: 'Japan',
    effectiveTaxYear: '2025 (R7)',
    jurisdiction: 'National income tax (employment-focused approximation)',
    sources: [
      {
        title: 'NTA income tax quick table (速算表)',
        url: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm'
      },
      {
        title: 'NTA employment income deduction',
        url: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1410.htm'
      },
      {
        title: 'NTA 2025 basic deduction reform page',
        url: 'https://www.nta.go.jp/users/gensen/2025kiso/index.htm'
      }
    ]
  },
  {
    code: 'SE',
    countryName: 'Sweden',
    effectiveTaxYear: '2025',
    jurisdiction: 'Employment income tax (municipal + state + standard fees)',
    sources: [
      {
        title: 'Skatteverket rates and amounts 2025',
        url: 'https://www.skatteverket.se/privat/skatter/beloppochprocent/2025'
      },
      {
        title: 'Skatteverket grundavdrag',
        url: 'https://www.skatteverket.se/privat/skatter/arbeteochinkomst/askattsedelochskattetabeller/grundavdrag'
      },
      {
        title: 'Skatteverket jobbskatteavdrag',
        url: 'https://www.skatteverket.se/privat/skatter/arbeteochinkomst/skattereduktioner/jobbskatteavdrag'
      }
    ]
  },
  {
    code: 'TH',
    countryName: 'Thailand',
    effectiveTaxYear: '2567 / 2024 baseline (from provided spec)',
    jurisdiction: 'Personal income tax (employment-focused approximation)',
    sources: [
      {
        title: 'Revenue Department tax calculation method',
        url: 'https://www.rd.go.th/555.html'
      },
      {
        title: 'Revenue Department allowances update',
        url: 'https://www.rd.go.th/fileadmin/download/tax_deductions_update280168.pdf'
      },
      {
        title: 'Revenue Department tax rate table',
        url: 'https://www.rd.go.th/59670.html'
      }
    ]
  },
  {
    code: 'CH',
    countryName: 'Switzerland',
    effectiveTaxYear: '2025',
    jurisdiction: 'Federal income tax + Zurich cantonal/municipal estimate (employment-focused)',
    sources: [
      {
        title: 'ESTV federal direct tax tariffs',
        url: 'https://www.estv.admin.ch/estv/de/home/direkte-bundessteuer/dbst-steuertarife.html'
      },
      {
        title: 'ESTV federal tax table 2025 (PDF)',
        url: 'https://www.estv.admin.ch/dam/estv/de/dokumente/dbst/tarife/dbst-tarife-58c-2025-de.pdf'
      },
      {
        title: 'ESTV deductions and allowances',
        url: 'https://www.estv.admin.ch/estv/de/home/direkte-bundessteuer/dbst-steuertarife/abzuege.html'
      }
    ]
  },
  {
    code: 'UK',
    countryName: 'United Kingdom',
    effectiveTaxYear: '2025/26 (6 April 2025 to 5 April 2026)',
    jurisdiction: 'England/Wales/Northern Ireland income tax + employee NIC (employment-focused)',
    sources: [
      {
        title: 'GOV.UK income tax rates and personal allowance',
        url: 'https://www.gov.uk/income-tax-rates'
      },
      {
        title: 'GOV.UK National Insurance rates and letters',
        url: 'https://www.gov.uk/national-insurance-rates-letters'
      },
      {
        title: 'HMRC Self Assessment guidance',
        url: 'https://www.gov.uk/self-assessment-tax-returns'
      }
    ]
  },
  {
    code: 'USCA',
    countryName: 'USA (California)',
    effectiveTaxYear: '2025 (filed in 2026)',
    jurisdiction: 'US federal + California income tax + payroll deductions (employment-focused)',
    sources: [
      {
        title: 'IRS federal income tax rates and brackets',
        url: 'https://www.irs.gov/filing/federal-income-tax-rates-and-brackets'
      },
      {
        title: 'California FTB 2025 tax rate schedules',
        url: 'https://www.ftb.ca.gov/forms/2025/2025-540-tax-rate-schedules.pdf'
      },
      {
        title: 'IRS publication and rates index',
        url: 'https://www.irs.gov/forms-pubs'
      }
    ]
  },
  {
    code: 'MY',
    countryName: 'Malaysia',
    effectiveTaxYear: 'YA 2025 (income year 2025, filed in 2026)',
    jurisdiction: 'Malaysia personal income tax (employment-focused approximation)',
    sources: [
      {
        title: 'LHDN resident tax rate table (YA 2023-2025)',
        url: 'https://www.hasil.gov.my/en/individual/individual-life-cycle/income-declaration/tax-rate/'
      },
      {
        title: 'LHDN non-resident tax rate guidance',
        url: 'https://www.hasil.gov.my/en/individual/individual-life-cycle/income-declaration/non-resident/'
      },
      {
        title: 'LHDN tax reliefs (YA 2025)',
        url: 'https://www.hasil.gov.my/en/individual/individual-life-cycle/income-declaration/tax-reliefs/'
      },
      {
        title: 'KWSP mandatory contribution rates',
        url: 'https://www.kwsp.gov.my/en/employer/responsibilities/mandatory-contribution'
      },
      {
        title: 'PERKESO contributions and EIS rates',
        url: 'https://www.perkeso.gov.my/en/uncategorised/778-contributions.html'
      }
    ]
  },
  {
    code: 'SG',
    countryName: 'Singapore',
    effectiveTaxYear: 'YA 2026 (income year 2025)',
    jurisdiction: 'Singapore personal income tax (employment-focused approximation)',
    sources: [
      {
        title: 'IRAS individual income tax rates and residency rules',
        url: 'https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-residency-and-tax-rates/individual-income-tax-rates'
      },
      {
        title: 'IRAS tax reliefs',
        url: 'https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-reliefs-rebates-and-deductions/tax-reliefs'
      },
      {
        title: 'CPF OW ceiling reference',
        url: 'https://www.cpf.gov.sg/service/article/what-is-the-ordinary-wage-ow-ceiling'
      },
      {
        title: 'CPF contribution-rate change notice (shows 2025 to 2026 rates)',
        url: 'https://www.cpf.gov.sg/service/article/what-are-the-changes-to-the-cpf-contribution-rates-for-senior-workers-from-1-january-2026'
      }
    ]
  },
  {
    code: 'IN',
    countryName: 'India',
    effectiveTaxYear: 'FY 2025-26 / AY 2026-27',
    jurisdiction: 'India personal income tax (new regime, employment-focused approximation)',
    sources: [
      {
        title: 'Union Budget 2025-26 speech (new regime slab proposal and 12L/12.75L note)',
        url: 'https://www.indiabudget.gov.in/doc/bspeech/bs2025_26.pdf'
      },
      {
        title: 'Income Tax Department AY 2026-27 slab and surcharge guidance',
        url: 'https://www.incometax.gov.in/iec/foportal/help/individual-business-profession'
      },
      {
        title: 'PIB Budget 2025-26 tax-slab release',
        url: 'https://www.pib.gov.in/PressNoteDetails.aspx?ModuleId=3&NoteId=154926'
      }
    ]
  }
];

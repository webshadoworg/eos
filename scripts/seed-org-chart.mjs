// Seed the Accountability Chart with the structure from the base44 PDF.
// Walks a nested JS tree and inserts seats with parent_id wiring.

import 'dotenv/config';
import pg from 'pg';

const url = process.env.SUPABASE_DB_SESSION_POOLER_URL || process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('SUPABASE_DB_SESSION_POOLER_URL or SUPABASE_DB_URL must be set (see scripts/.env)');
  process.exit(1);
}
const client = new pg.Client({ connectionString: url });
await client.connect();

// Map person full_name → employee id (case-insensitive, exact match first, then lastname).
const { rows: employees } = await client.query('select id, full_name, email from employees');
function findEmployeeId(name) {
  if (!name) return null;
  const lower = name.toLowerCase().trim();
  const exact = employees.find((e) => e.full_name?.toLowerCase() === lower);
  if (exact) return exact.id;
  // Try partial match on first or last name.
  const parts = lower.split(/\s+/);
  for (const p of parts) {
    if (p.length < 3) continue;
    const hit = employees.find((e) => e.full_name?.toLowerCase().includes(p));
    if (hit) return hit.id;
  }
  return null;
}

// The chart as a tree of {title, person, responsibilities, children}.
const tree = {
  title: 'Visionary',
  person: 'Yechezkel Stelzer',
  responsibilities: [
    'Big Ideas',
    'Creativity/Problem Solving',
    'Big Relationships',
    'Culture',
    'R&D',
  ],
  children: [
    {
      title: 'Integrator',
      person: 'Mendy Elishevitz',
      responsibilities: [
        'Lead, Manage, Accountability',
        'Business Plan Execution',
        'Remove Obstacles & Barriers',
        'Special Projects',
      ],
      children: [
        {
          title: 'Fundraising',
          person: 'Yechezkel Stelzer',
          responsibilities: [
            'LMA',
            'Overall fundraising strategy & process',
            'Authorizing commission payments',
          ],
          children: [
            {
              title: 'Donor Relations Manager',
              person: 'Florin O',
              responsibilities: [
                'Online Campaigns: High Holiday Campaign, Raffles',
                'Donor Data Management (CRM)',
                'Fundraiser Tech Support and onboarding',
                'Donor Funnel',
                'Pledge Collection',
                "Asisting/Coaching Yaakov & Prioritizing Yaakov's Work",
                'Commission Calculations',
                'Revenue Recovery & Payment Updates',
                'Thanking Donors Oversight - incl. personal msgs',
              ],
              children: [
                {
                  title: 'Fundraising Support Admin.',
                  person: 'Kejsi Rama',
                  responsibilities: [
                    'Manual donor updates in CRM',
                    'Receipt & credit card management',
                    'Pledge setup assistance',
                  ],
                },
              ],
            },
            {
              title: 'Large Gifts Development',
              person: 'Yaakov Nadel',
              responsibilities: [
                'Fundraising zoom meetings',
                'Arranging & Going on Trips (1 per quarter)',
                'Follow ups (in collaboration with team)',
                'Creating fundraising materials & presentations',
              ],
              children: [
                {
                  title: 'Trips Consultant',
                  person: 'Michael Weiss',
                  responsibilities: [
                    'Scheduling upcoming trips',
                    'Preparing leads for trip',
                    'Scheduling trip meetings',
                    'Collecting trip pledges from MW donors',
                  ],
                },
                {
                  title: 'Trip Consultant',
                  person: 'Bunni Freedman',
                  responsibilities: [
                    'Joining Yaakov on trips',
                    'Getting leads for trips',
                  ],
                },
              ],
            },
            {
              title: 'Fundraising Manager',
              person: 'Yudi Jeger',
              responsibilities: [
                'LMA',
                'Overseeing & coaching fundraisers (except Yaakov)',
                'Identifying Potential Leads',
                'Assigning best potential leads to fundraisers',
                'Consulting on high level decisions',
                'Hiring fundraising staff (part-time, full-time)',
              ],
              children: [
                {
                  title: 'Caller',
                  person: 'RG SK',
                  responsibilities: [
                    'Calling leads list',
                    'Schedule online donor meetings for fundraisers',
                    'Collect & record lead data',
                  ],
                },
                {
                  title: 'Fundraiser',
                  person: 'CF AM',
                  responsibilities: [
                    'New & prospective donor pitching',
                    'Follow ups & renewing prospects/donors',
                    'Collecting significant pledges',
                  ],
                },
              ],
            },
          ],
        },
        {
          title: 'Operations',
          person: 'Mendy Elishevitz',
          responsibilities: [
            'LMA',
            'Platform development',
            'Manage programmers/designers/support',
            'Quality control & maintenance',
            'Information technology',
          ],
          children: [
            {
              title: 'Platform Design',
              person: 'Nick Zaitsev',
              responsibilities: [
                'Requirements gathering',
                'UX design',
                'Prototyping & testing',
                'Collaboration with developers',
                'Documentation',
              ],
            },
            {
              title: 'Tech Lead',
              person: 'Vitaly Loyko',
              responsibilities: [
                'LMA',
                'Sprint Planning aligned with Rocks',
                'Allocate programming tasks',
                'Backlog management',
                'Maximize team efficiency and output',
              ],
              children: [
                {
                  title: 'Web Developer',
                  person: 'VL RA',
                  responsibilities: [
                    'Write code for new features',
                    'Keep project code up to date',
                    'Communicate with designers/QA',
                  ],
                },
                {
                  title: 'Quality Assurance',
                  person: 'Helga Parniuk',
                  responsibilities: [
                    'Test new features before release',
                    'Ensure Project Stability',
                    'Create Tickets for New Bugs',
                  ],
                },
              ],
            },
            {
              title: 'User Success (platform)',
              person: 'Nir Shmerts',
              responsibilities: [
                'Monitor Badges & suggest ways to Improve Results',
                'Evaluate & improve user journeys',
                'Improve long-term user experience',
                'Implement and analyze user surveys',
                'Converting users to donors',
              ],
            },
            {
              title: 'Website Admin Lead',
              person: 'Mendy Elishevitz',
              responsibilities: [
                'LMA',
                'Language Laison',
                'Customer Service Strategy',
              ],
              children: [
                {
                  title: 'Hebrew Site',
                  person: null,
                  responsibilities: [
                    'LMA',
                    'Hebrew user support',
                    'Hebrew user experience',
                    'Hebrew site maintenance',
                    'Creating/sending Hebrew newsletters',
                    'Video/audio editing projects',
                  ],
                  children: [
                    {
                      title: 'Hebrew Content',
                      person: 'Nir Shmerts',
                      responsibilities: [
                        'Content creation for site & newsletters',
                        'Content for expert support macros',
                        'UX Translations',
                      ],
                    },
                  ],
                },
                {
                  title: 'Yiddish Site',
                  person: 'Shia *',
                  responsibilities: [
                    'Maintain Site, Forum & Newsletter',
                    'Yiddish Marketing & Fundraising',
                    'Meet with Hanhala & Community Leaders',
                    'Support and welcome new members',
                  ],
                },
                {
                  title: 'English Site',
                  person: 'Chaim Klein',
                  responsibilities: [
                    'LMA',
                    'English site maintenance',
                    'English user support',
                    'Creating/sending English newsletters',
                    'Volunteer Coordination',
                  ],
                  children: [
                    {
                      title: 'Spouses Support (Yehudis)',
                      person: null,
                      responsibilities: [
                        'One-time phone/email consultations for spouses',
                        'Facilitate spouses phone conference',
                        "Manage sister's list for volunteers",
                        "Manage volunteers for spouse's forum",
                        'Respond to spouses on Intercom',
                      ],
                    },
                    {
                      title: "Women's Support (RL)",
                      person: null,
                      responsibilities: ['Female member support by chat/phone/email'],
                    },
                  ],
                },
                {
                  title: 'English 12-Step Coordinator',
                  person: 'Efraim 12 Steps',
                  responsibilities: [
                    'Conduct Initial Calls',
                    "Organize and Enhance Vetter's Group Operations",
                    'Document and Analyze Call Data',
                    'Follow Ups',
                    'Expand 12-Step Sign-Ups on GYE',
                  ],
                },
              ],
            },
            {
              title: 'Systems Management, Donor Data & Analytics',
              person: 'Florin O',
              responsibilities: [
                'Drive CRM strategy, integrations & automations to optimize fundraising funnel',
                'Lead donor services, payment processing & campaigns support',
                'Ensure data accuracy, compliance & reporting across systems',
                'Onboard & train staff on CRM systems and processes',
                'Manage member data, assessments & platform analytics',
              ],
            },
          ],
        },
        {
          title: 'Finance',
          person: 'Yechezkel Stelzer',
          responsibilities: [
            'LMA',
            'Forecasting, reporting, and budgets',
            'AR/AP Management',
            'Approving payments',
            'HR contracts',
          ],
          children: [
            {
              title: 'Finance Support',
              person: null,
              responsibilities: [],
            },
            {
              title: 'Accounts Payable',
              person: 'Huvi Indik',
              responsibilities: [
                'Accounts Payable',
                'Monthly Income statement reporting',
              ],
            },
          ],
        },
      ],
    },
  ],
};

// Clear existing seats so re-seeding is idempotent.
await client.query('delete from org_seats');

async function insert(node, parentId, order) {
  const { rows } = await client.query(
    `insert into org_seats (parent_id, title, person_name, employee_id, responsibilities, display_order)
     values ($1, $2, $3, $4, $5, $6)
     returning id`,
    [
      parentId,
      node.title,
      node.person,
      findEmployeeId(node.person),
      JSON.stringify(node.responsibilities || []),
      order,
    ],
  );
  const id = rows[0].id;
  const children = node.children || [];
  for (let i = 0; i < children.length; i++) {
    await insert(children[i], id, i);
  }
}

await insert(tree, null, 0);

const { rows: countRow } = await client.query('select count(*)::int from org_seats');
console.log(`seeded ${countRow[0].count} seats`);
await client.end();

import { NextResponse } from 'next/server';

// Placeholder: Newspaper articles endpoint
// In a real system, you would fetch articles from a CMS or external API
const sampleArticles = [
  {
    id: '1',
    title: 'Why It Matters: Climate Change',
    url: 'https://example.com/articles/climate-change',
    summary: 'A deep dive into the impact of climate change on global health.',
    published_at: '2026-02-20',
  },
  {
    id: '2',
    title: 'Education Reform in 2026',
    url: 'https://example.com/articles/education-reform',
    summary: 'How new policies are shaping the future of learning.',
    published_at: '2026-02-18',
  },
];

export async function GET() {
  return NextResponse.json({ articles: sampleArticles });
}

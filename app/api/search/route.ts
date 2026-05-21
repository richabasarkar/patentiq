import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const full = req.nextUrl.searchParams.get('full') === 'true';
  if (q.length < 1) return NextResponse.json([]);

  const isArtUnit = /^\d{3,4}$/.test(q);
  const limit = full ? 50 : 10;
  let data, error;

  if (isArtUnit) {
    ({ data, error } = await supabase
      .from('examiners')
      .select('id, name, art_unit_number, grant_rate_3yr')
      .eq('art_unit_number', q)
      .not('grant_rate_3yr', 'is', null)
      .gt('grant_rate_3yr', 0)
      .order('grant_rate_3yr', { ascending: false })
      .limit(limit));
  } else {
    // Split query into words and match each word anywhere in the name
    const words = q.split(' ').filter(Boolean);
    let query = supabase
      .from('examiners')
      .select('id, name, art_unit_number, grant_rate_3yr')
      .not('grant_rate_3yr', 'is', null)
      .gt('grant_rate_3yr', 0);

    for (const word of words) {
      query = query.ilike('name', `%${word}%`);
    }

    ({ data, error } = await query
      .order('total_applications', { ascending: false })
      .limit(limit));
  }

  if (error) return NextResponse.json([]);
  return NextResponse.json(data ?? []);
}

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json([]);

  // Detect if query looks like an art unit number (3-4 digits)
  const isArtUnit = /^\d{3,4}$/.test(q);

  let data, error;

  if (isArtUnit) {
    // Search by art unit number
    ({ data, error } = await supabase
      .from('examiners')
      .select('id, name, art_unit_number, grant_rate_3yr')
      .eq('art_unit_number', q)
      .order('grant_rate_3yr', { ascending: false })
      .limit(20));
  } else {
    // Search by name
    ({ data, error } = await supabase
      .from('examiners')
      .select('id, name, art_unit_number, grant_rate_3yr')
      .ilike('name', `%${q}%`)
      .order('total_applications', { ascending: false })
      .limit(10));
  }

  if (error) return NextResponse.json([]);
  return NextResponse.json(data ?? []);
}
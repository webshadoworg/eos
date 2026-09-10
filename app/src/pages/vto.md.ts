import type { APIRoute } from 'astro';
import { supabase } from '~/lib/supabase';
import { vtoToMarkdown } from '~/lib/vto-markdown';

// Download the V/TO as a Markdown file. Cookie-authenticated via middleware.
export const GET: APIRoute = async () => {
  const { data, error } = await supabase
    .from('vtos')
    .select('vision, traction, swot')
    .limit(1)
    .maybeSingle();
  if (error) return new Response(error.message, { status: 500 });

  const md = vtoToMarkdown(data?.vision ?? {}, data?.traction ?? {}, data?.swot ?? {}, {
    title: 'GYE — Vision/Traction Organizer',
  });
  const filename = `gye-vto-${new Date().toISOString().slice(0, 10)}.md`;

  return new Response(md, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
};

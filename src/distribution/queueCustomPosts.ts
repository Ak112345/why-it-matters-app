import { supabase } from '../utils/supabaseClient';

export interface CarouselPostOptions {
  mediaId: string;
  caption: string;
  scheduledTime?: Date;
}

export async function queueInstagramCarouselPost(options: CarouselPostOptions) {
  const { mediaId, caption, scheduledTime } = options;
  // Insert into posting_queue with type 'carousel'
  const { data, error } = await supabase.from('posting_queue').insert({
    final_video_id: mediaId,
    platform: 'instagram',
    type: 'carousel',
    caption,
    scheduled_for: scheduledTime ? scheduledTime.toISOString() : new Date().toISOString(),
    status: 'pending',
    created_at: new Date().toISOString(),
  }).select().single();
  if (error) throw error;
  return data;
}

export interface ArticlePostOptions {
  articleId: string;
  title: string;
  url: string;
  summary: string;
  scheduledTime?: Date;
}

export async function queueArticlePost(options: ArticlePostOptions) {
  const { articleId, title, url, summary, scheduledTime } = options;
  // Insert into posting_queue with type 'article'
  const { data, error } = await supabase.from('posting_queue').insert({
    article_id: articleId,
    platform: 'facebook',
    type: 'article',
    title,
    url,
    summary,
    scheduled_for: scheduledTime ? scheduledTime.toISOString() : new Date().toISOString(),
    status: 'pending',
    created_at: new Date().toISOString(),
  }).select().single();
  if (error) throw error;
  return data;
}

-- Seed: Destroyed by Moths channel with the live template's quests, news and rewards as placeholders.
-- XP, copy and links are placeholders until Amanda sends final verbiage; edit them in /admin.
insert into public.channels (slug, name, tagline, timezone, links, settings) values (
  'destroyedbymoths', 'Destroyed by Moths', 'Fans compete, vote and unlock rewards.', 'America/Los_Angeles',
  '{"spotify":"https://open.spotify.com/","instagram":"https://instagram.com/","tiktok":"https://tiktok.com/","merch":"https://example.com/store"}'::jsonb,
  '{"merch_store_name":"Destroyed by Moths Store","review_cadence":"The band reviews these every few days.","submissions_per_day":10,"max_pending":5,"theme":{"accent":"#F2B441"}}'::jsonb
) on conflict (slug) do nothing;

do $$
declare ch uuid; q uuid;
begin
  select id into ch from public.channels where slug = 'destroyedbymoths';

  insert into public.quests (channel_id, type, title, description, xp, cta_label, repeat_rule, sort_order) values
    (ch, 'daily_visit', 'Daily visit reward', 'Open the Destroyed by Moths channel page today.', 150, 'Awarded on arrival', 'daily', 70);

  insert into public.quests (channel_id, type, title, description, xp, cta_label, deadline, sort_order, config) values
    (ch, 'quiz', 'How well do you know the Moths?', 'Five questions. Get them all right for the full XP.', 400, 'Play', '2027-03-30T17:11:00Z', 10,
     '{"questions":[
       {"q":"What is the title of our latest single?","options":["Her Shoes","Lonely Together","Moth Season","Night Drive"]},
       {"q":"Which song can fans sing with us live as a reward?","options":["Her Shoes","Lonely Together","Porch Light","Static"]},
       {"q":"How many live shows have we played so far?","options":["None yet","One","Ten","Fifty"]},
       {"q":"What are we named after?","options":["A moth","A storm","A street","A ship"]},
       {"q":"When does a new Song of the Week vote open?","options":["Every Monday","Every Friday","Once a month","Never"]}
     ]}'::jsonb)
    returning id into q;
  insert into public.quiz_answers (quest_id, question_index, correct_index) values (q, 0, 0), (q, 1, 1), (q, 2, 0), (q, 3, 0), (q, 4, 0);

  insert into public.quests (channel_id, type, title, description, xp, cta_label, deadline, sort_order, config) values
    (ch, 'poll', 'What should we make next?', 'Four quick questions so we stop guessing what you want to see.', 300, 'Respond', '2027-03-30T17:11:00Z', 20,
     '{"questions":[
       {"q":"What should the next release be?","options":["A single","An EP","A full album","A live session"]},
       {"q":"What do you want more of?","options":["Studio diaries","Lyric breakdowns","Live clips","Behind the scenes"]},
       {"q":"Which format first?","options":["Vinyl","Cassette","Digital only","CD"]},
       {"q":"How often should we post?","options":["Daily","A few times a week","Weekly","Only when it matters"]}
     ]}'::jsonb),
    (ch, 'poll', 'Plan our first tour', 'We have never played live. Tell us where to start.', 300, 'Respond', '2027-03-30T17:11:00Z', 30,
     '{"questions":[
       {"q":"Which city should get the first show?","options":["Los Angeles","New York","Chicago","Austin"]},
       {"q":"What kind of room?","options":["Tiny club","Record store","House show","Theater"]},
       {"q":"Weeknight or weekend?","options":["Weeknight","Weekend"]}
     ]}'::jsonb),
    (ch, 'poll', 'Build the first live setlist', 'Pick our opener, our closer and a cover.', 150, 'Respond', '2027-03-30T17:11:00Z', 40,
     '{"questions":[
       {"q":"Opener","options":["Her Shoes","Lonely Together","Porch Light","Static"]},
       {"q":"Closer","options":["Her Shoes","Lonely Together","Porch Light","Static"]},
       {"q":"Cover","options":["Linger","Maps","Dreams","Cherry Wine"]}
     ]}'::jsonb),
    (ch, 'poll', 'Which song gets a session take?', 'The winning song gets a stripped-back session take.', 100, 'Respond', '2027-03-30T17:11:00Z', 50,
     '{"questions":[{"q":"Pick the song","options":["Her Shoes","Lonely Together","Porch Light","Static"]}]}'::jsonb);

  insert into public.quests (channel_id, type, title, description, xp, cta_label, repeat_rule, sort_order, config) values
    (ch, 'invite', 'Invite friends', '+1,000 XP each, every friend counts.', 1000, 'Invite', 'per_item', 60, '{"cap":10}'::jsonb);

  insert into public.quests (channel_id, type, title, description, xp, cta_label, link_url, repeat_rule, sort_order) values
    (ch, 'visit_link', 'Listen to our new single "Her Shoes"', 'Press play, then come back for your XP.', 100, 'Visit link', 'https://open.spotify.com/', 'once', 80),
    (ch, 'visit_link', 'Visit the merch store', 'Browse the store. One visit a day earns XP.', 50, 'Visit link', 'https://example.com/store', 'daily', 120);

  insert into public.quests (channel_id, type, title, description, xp, cta_label, repeat_rule, sort_order, config) values
    (ch, 'weekly_vote', 'Song of the week', 'Your song on repeat this week. A new vote every Monday.', 250, 'Respond', 'weekly', 90,
     '{"questions":[{"q":"Your song on repeat this week","options":["Her Shoes","Lonely Together","Porch Light","Static"]}]}'::jsonb);

  insert into public.quests (channel_id, type, title, description, xp, cta_label, repeat_rule, sort_order, config) values
    (ch, 'photo_proof', 'Playlist proof', 'Save "Her Shoes" to a playlist and upload a screenshot.', 200, 'Submit proof', 'once', 100, '{"auto_approve":false,"kind":"playlist","hint":"Show the playlist name (or Liked Songs) and the song title."}'::jsonb),
    (ch, 'email_signup', 'Join the Moths list', 'Get new songs, shows and drops by email.', 100, 'Join list', 'once', 110, '{"consent":"Yes, email me about Destroyed by Moths. Unsubscribe any time."}'::jsonb),
    (ch, 'photo_proof', 'Recreate the album cover', 'Make your own version of the cover and upload it. The band may feature it.', 250, 'Submit proof', 'weekly', 130, '{"auto_approve":true,"kind":"fan_art","rights":"I made this.","hint":"Any medium counts: paint, collage, photo, digital."}'::jsonb),
    (ch, 'photo_proof', 'Merch in the wild', 'Wearing the merch somewhere? Show us.', 300, 'Submit proof', 'once', 140, '{"auto_approve":true,"kind":"merch_wild","rights":"I took this and everyone in it agrees.","hint":"Merch visible, anywhere in the world."}'::jsonb),
    (ch, 'receipt_proof', 'Show your Moths merch', 'Bought merch? Upload the receipt and type the order number.', 300, 'Submit proof', 'per_item', 150, '{"hint":"Show merchant, date, order number and total. Blur card digits and your address."}'::jsonb),
    (ch, 'social_link', 'Share "Her Shoes"', 'Post, reel or TikTok about the single and paste the link to your post.', 100, 'Submit link', 'weekly', 160, '{"variant":"share"}'::jsonb),
    (ch, 'social_link', 'Tag us', 'Tag @destroyedbymoths in a post and paste the link.', 100, 'Submit link', 'weekly', 170, '{"variant":"tag"}'::jsonb);

  insert into public.quests (channel_id, type, title, description, xp, cta_label, repeat_rule, sort_order, status, config) values
    (ch, 'social_screenshot', 'Comment on our post', 'Comment on our latest post and upload a screenshot with your handle visible.', 100, 'Submit proof', 'weekly', 180, 'draft', '{"variant":"comment"}'::jsonb);

  insert into public.news_items (channel_id, title, body, link_url, link_label, sort_order) values
    (ch, '"Her Shoes" is out', 'Our new single is out everywhere. Save it, share it, send it to someone who needs it.', 'https://open.spotify.com/', 'Listen', 10),
    (ch, 'Song of the week is open', 'Vote for the song you have on repeat. A new vote opens every Monday.', null, null, 20),
    (ch, 'Show us your art', 'Recreate the cover in any medium and upload it. The band picks favourites to feature.', null, null, 30),
    (ch, 'Merch is live', 'The first run of shirts and prints is up. Receipts earn XP.', 'https://example.com/store', 'Shop', 40);

  insert into public.rewards (channel_id, type, title, body, stock, delivery_type, delivery_payload, sort_order) values
    (ch, 'claim', 'Unreleased demo', 'A rough mix nobody else has heard.', 200, 'link', 'https://example.com/demo', 10),
    (ch, 'claim', 'Sing "Lonely Together" live', 'Your name on the list to sing it with us at the first show.', 200, 'text', 'You are on the list. We will email details before the show.', 20),
    (ch, 'claim', 'Monthly Moths session', 'A seat in the monthly video session with the band.', 200, 'text', 'You are in. The invite goes out by email the week of the session.', 30);
  insert into public.rewards (channel_id, type, title, body, draw_ends_at, sort_order) values
    (ch, 'draw', 'Jam session seat', 'One fan joins a jam session.', now() + interval '60 days', 40),
    (ch, 'draw', 'Get featured', 'One fan gets featured on our page.', now() + interval '60 days', 50);
end $$;

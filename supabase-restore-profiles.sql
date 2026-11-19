-- Optional recovery for the placeholder profiles created while migrating
-- public.post. This restores the profile details present in the repository's
-- previous profile data. Profile selection now uses public.users.id directly.
-- Existing non-placeholder profile rows are left unchanged.

begin;

insert into public.users as existing (
  id, email, full_name, role, birthdate, location, interests, dream, about, image,
  created_at
) values
  (
    '35b7257a-dad7-41b7-9816-dc9cf36e40e1', 'usopp@onepiece.com', 'Usopp', 'sniper',
    '2007-04-01', 'East Blue',
    array['Sniping', 'Inventing', 'Storytelling', 'Fishing'],
    'Become a brave warrior of the sea',
    $usopp_about$CEO of 'I'm not scared, I'm just being tactical' and founder of an 8,000-man army where I'm the only member and the admin. I can snipe a fly from three islands away, yet somehow always catch a sudden case of 'Can't-Go-On-This-Island Disease' right before a boss fight. 100% legit, trust me bro.$usopp_about$,
    '/images/usopp.jpg', now()
  ),
  (
    '49237602-2c30-447f-a42f-f0ea93e62d44', 'zoro@onepiece.com', 'Roronoa Zoro', 'swordsman',
    '2007-11-11', 'East Blue',
    array['Swordsmanship', 'Training', 'Sleeping'],
    'Become the world''s greatest swordsman',
    $zoro_about$Three-sword style master, zero-sense-of-direction survivor. I walked to the ship's bathroom and somehow ended up in a completely different anime. I don't get lost; the island just keeps moving. Do not wake me up unless there's sake or someone trying to kill us.$zoro_about$,
    '/images/zoro.jpeg', now()
  ),
  (
    '533e3e5a-b742-417c-86c9-4af0b3e134c5', 'luffy@onepiece.com', 'Monkey D. Luffy', 'captain',
    '2007-05-05', 'East Blue',
    array['Eating', 'Fighting', 'Adventure'],
    'Become the Pirate King',
    $luffy_about$Future Pirate King running on two brain cells that only activate when meat is nearby. My master plan? Punch first and let Nami and Jinbe deal with the property damage. Bring me a roasted drumstick and you're officially part of my crew, even if you were trying to fight me five minutes ago.$luffy_about$,
    '/images/luffy.jpg', now()
  ),
  (
    '7c17bad9-6eb1-4c8e-b4e2-4bcbafc3e4a5', 'robin@onepiece.com', 'Nico Robin', 'archaeologist',
    '2007-02-06', 'West Blue',
    array['Archaeology', 'Ancient history', 'Reading', 'Quiet cafes'],
    'Learn the true history of the world',
    $robin_about$I enjoy quiet mornings, ancient texts, and casually dropping horrifying scenarios while we're in the middle of a storm ('Perhaps they drowned and were eaten by sea kings'). I'm not creepy; I'm just statistically realistic.$robin_about$,
    '/images/robin.jpg', now()
  ),
  (
    '8b654610-3c70-4554-86a0-e0a958538563', 'sanji@onepiece.com', 'Vinsmoke Sanji', 'cook',
    '2007-03-02', 'North Blue',
    array['Cooking', 'Finding ingredients', 'Romance', 'Kicking'],
    'Find the All Blue',
    $sanji_about$Michelin-star gourmet chef for the ladies, leftover scraps and a flying kick for the guys, especially Moss Head. Yes, the fridge has a steel padlock because our captain has a black hole for a stomach. Nami-san! Robin-chwan! Say the word and I'll cook a five-course meal mid-battle!$sanji_about$,
    '/images/sanji.jpg', now()
  ),
  (
    '93ce88b5-2062-4083-af8f-dfcaf3133320', 'nami@onepiece.com', 'Nami', 'navigator',
    '2007-07-03', 'East Blue',
    array['Navigation', 'Weather', 'Tangerines', 'Treasure'],
    'Draw a map of the entire world',
    $nami_about$Navigator, meteorologist, and chief debt collector on this floating circus. Nothing in life is free; even breathing near my treasure comes with a 300% interest rate. I dream of swimming in gold, then wake up to Luffy bankrupting us before breakfast.$nami_about$,
    '/images/nami.jpg', now()
  )
on conflict (id) do update set
  full_name = excluded.full_name,
  role = excluded.role,
  birthdate = excluded.birthdate,
  location = excluded.location,
  interests = excluded.interests,
  dream = excluded.dream,
  about = excluded.about,
  image = excluded.image
where existing.full_name like 'Legacy member %';

commit;

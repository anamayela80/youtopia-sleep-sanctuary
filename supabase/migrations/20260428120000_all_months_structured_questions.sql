-- Structured questions {label, text, placeholder} for all 12 months
-- April already set; updating all months for consistency and completeness.

-- JANUARY — A New Reality
UPDATE monthly_themes SET questions = '[
  {
    "label": "What are you done feeling?",
    "text": "Not what you want more of — what you''re finally ready to stop carrying. The heaviness, the guilt, the smallness. Name it, even if it''s just a feeling without a story.",
    "placeholder": "I''m done feeling like I have to earn my place. I''m done feeling like I''m always almost ready..."
  },
  {
    "label": "Who do you want to become?",
    "text": "Not your goals. Not your achievements. The person behind them — how do they move through a Tuesday? How do they speak to themselves? What do they no longer explain or apologize for?",
    "placeholder": "She doesn''t wait for permission. She wakes up and... she doesn''t second-guess..."
  },
  {
    "label": "What would your life look like if you actually believed things could be different?",
    "text": "Forget what''s realistic. Picture the version of your life that feels almost too good to say out loud — who''s in it, what are you doing, what are you no longer doing?",
    "placeholder": "I''d be living in... I''d finally have... my relationship with [name] would feel like..."
  }
]'::jsonb
WHERE month_key = 'jan';

-- FEBRUARY — The Child Who Learned to Hide
UPDATE monthly_themes SET questions = '[
  {
    "label": "What did you learn to hide?",
    "text": "As a child, something in you got the message that parts of you were too much — too loud, too needy, too sensitive, too ambitious. What was it? What did you learn to keep quiet?",
    "placeholder": "I learned to hide how much I wanted to be seen. I learned to stop crying in front of... I learned that wanting too much meant..."
  },
  {
    "label": "Who were you before you started managing how you were perceived?",
    "text": "There was a version of you before the editing — before you learned to be palatable, easy, smaller. What were you like? What did you love without apology?",
    "placeholder": "I used to sing out loud everywhere. I used to tell people exactly what I thought. I used to believe I was going to..."
  },
  {
    "label": "What would you tell that child now?",
    "text": "If you could sit with the younger version of you — the one who was just starting to learn to disappear — what would you need them to hear?",
    "placeholder": "I would tell her that she doesn''t have to earn love. That the parts she''s about to hide are the most important ones. That..."
  }
]'::jsonb
WHERE month_key = 'feb';

-- MARCH — The Voice That Isn't Yours
UPDATE monthly_themes SET questions = '[
  {
    "label": "Whose voice do you still carry?",
    "text": "There''s a voice in your head that isn''t really yours — a parent, a teacher, an ex, a culture. It tells you what you can and can''t be. Whose is it? What does it say?",
    "placeholder": "It sounds like my mother when she said... it tells me I''m too much, or not enough, specifically when..."
  },
  {
    "label": "What has that voice cost you?",
    "text": "Think about a specific moment — a choice you didn''t make, a version of yourself you held back, something you talked yourself out of because that voice said it wasn''t for you.",
    "placeholder": "I didn''t take the job because it said I wasn''t qualified. I stopped painting when it told me..."
  },
  {
    "label": "What''s the truest thing you know about yourself that that voice has never let you say?",
    "text": "Underneath all the noise, there''s something you know to be true about who you are. Something you''ve been afraid to claim. Say it here.",
    "placeholder": "I know that I am... I know I''m capable of... the truest thing about me, the thing I''ve been afraid to say out loud, is..."
  }
]'::jsonb
WHERE month_key = 'mar';

-- APRIL — What You're Allowed to Want (already set, re-setting for consistency)
UPDATE monthly_themes SET questions = '[
  {
    "label": "Who do you love?",
    "text": "Write the names of the people who matter most to you — a partner, siblings, children, a friend. What does it feel like to be with them when everything is okay?",
    "placeholder": "My brother Mateo, my sister Lucia, my partner Sam... when we''re all together and nothing is wrong, it feels like..."
  },
  {
    "label": "What have you stopped letting yourself want?",
    "text": "There''s something you''ve wanted for a long time that you''ve learned to keep quiet about — maybe it felt too big, too selfish, or just too far. What is it? Say it here like no one is watching.",
    "placeholder": "I''ve always wanted to... but I stopped believing it was for me because..."
  },
  {
    "label": "What does ''enough'' feel like?",
    "text": "Not luxury. Not excess. Just the feeling of enough — financially, in your body, in your day. What does that feel like? What are you doing? What''s happening around you?",
    "placeholder": "Enough feels like waking up and not immediately checking... it feels like being able to say yes to..."
  }
]'::jsonb
WHERE month_key = 'apr';

-- MAY — The Life You Keep Postponing
UPDATE monthly_themes SET questions = '[
  {
    "label": "What are you waiting for permission to start?",
    "text": "There''s something you want to do, be, or have that you keep putting just out of reach — you''ll start when the time is right, when you have more money, when the kids are older. What is it?",
    "placeholder": "I keep saying I''ll start when... but I''ve been saying that for years. What I actually want is..."
  },
  {
    "label": "What would you do next week if you stopped waiting?",
    "text": "Not in five years. Not when everything is lined up. If you woke up tomorrow and the waiting was over — what''s the first real thing you''d do? Who would you call?",
    "placeholder": "I''d call [name] and say yes to the thing I''ve been saying maybe to. I''d finally start... I''d stop pretending that I''m fine with..."
  },
  {
    "label": "Who is living the life you want?",
    "text": "There''s someone — real or imagined — who isn''t waiting. They''re already in the life you keep postponing. What do they have that you tell yourself you don''t?",
    "placeholder": "She has... she doesn''t apologize for wanting it. The difference between her and me right now is..."
  }
]'::jsonb
WHERE month_key = 'may';

-- JUNE — Who You Are When No One Is Watching
UPDATE monthly_themes SET questions = '[
  {
    "label": "Who are you when no one needs anything from you?",
    "text": "Not your role — not the parent, the employee, the partner, the responsible one. The you that exists before any of that. What do you do? What do you let yourself feel?",
    "placeholder": "When it''s just me, I... I think about... there''s a version of me that nobody really sees who..."
  },
  {
    "label": "What do you perform that you''re exhausted by?",
    "text": "There''s something you''ve gotten very good at being — capable, happy, together, fine. Something you perform so consistently that people don''t know it''s a performance. What does it cost you?",
    "placeholder": "I perform being fine when I''m not. I perform having it together. The one that exhausts me most is..."
  },
  {
    "label": "What would you let yourself be if you weren''t being watched?",
    "text": "Sillier, softer, angrier, louder, more ambitious, less certain. Something you edit out of yourself in front of others. What is it?",
    "placeholder": "I would let myself be... I would stop editing out... I would admit that I actually want..."
  }
]'::jsonb
WHERE month_key = 'jun';

-- JULY — Learning to Receive
UPDATE monthly_themes SET questions = '[
  {
    "label": "What are you bad at receiving?",
    "text": "Compliments, help, rest, love, money, care — something that, when it comes toward you, you deflect, minimize, or find a reason to give back. What happens in your body when it arrives?",
    "placeholder": "When someone compliments me, I immediately... when someone offers to help, I say... the thing I find hardest to just receive is..."
  },
  {
    "label": "Who in your life is offering something you haven''t fully let in?",
    "text": "There''s someone — a partner, a friend, a parent, a child — who wants to give you something you haven''t fully allowed yourself to take. Love, admiration, help, presence. Who is it?",
    "placeholder": "[Name] keeps telling me... keeps trying to... and I keep deflecting it because I tell myself..."
  },
  {
    "label": "What would it feel like to just let it land?",
    "text": "Imagine the thing you deflect most — the love, the help, the praise — actually landing. Not being given back. Not minimized. Just received, fully, into your body.",
    "placeholder": "If I actually let [name''s] love in, I think I would feel... if I stopped giving back the compliment and just said thank you, I think..."
  }
]'::jsonb
WHERE month_key = 'jul';

-- AUGUST — The Stories You Call Facts
UPDATE monthly_themes SET questions = '[
  {
    "label": "What have you decided is true about you that you''ve never questioned?",
    "text": "Something you say easily — ''I''m not good with money,'' ''I''m terrible at relationships,'' ''people like me don''t...'' — something that feels factual but started as a story. What is it?",
    "placeholder": "I''ve always said that I''m... I''ve believed since I was young that I don''t... people like me don''t get to..."
  },
  {
    "label": "Where did that story come from?",
    "text": "Was there a moment? A person? A thing that happened that first taught you this was true? Not to blame anyone, but to see it clearly: this was learned, not discovered.",
    "placeholder": "I think it started when... there was a moment in school / with my family / in that relationship where... and I decided then that..."
  },
  {
    "label": "What would be possible if that story were simply wrong?",
    "text": "Not just differently framed — actually wrong. If the story you''ve been calling a fact is just a story, what opens up?",
    "placeholder": "If I''m not actually bad with money, then I could... if I''m not actually too much for people, then... what becomes possible is..."
  }
]'::jsonb
WHERE month_key = 'aug';

-- SEPTEMBER — Becoming Intentional
UPDATE monthly_themes SET questions = '[
  {
    "label": "What parts of your life are you living by default?",
    "text": "Not chosen — inherited, continued by inertia, or fallen into. A job, a city, a habit, a way of relating. Something that runs on automatic because you''ve never stopped to ask if it''s actually what you want.",
    "placeholder": "I''m living [this part] by default — I never actually chose it, I just... if I actually chose it, it might look different..."
  },
  {
    "label": "If you had to design your ideal Tuesday from scratch, what would it include?",
    "text": "Not a fantasy — a real, livable Tuesday. The work, the people, the pace, the rhythms. What would a Tuesday feel like if you were truly living on purpose?",
    "placeholder": "My ideal Tuesday would start with... I''d work on... the people I''d see would be... by evening I would feel..."
  },
  {
    "label": "What one thing, if you changed it, would change everything else?",
    "text": "There''s usually one thing — a decision, a boundary, a habit, a relationship — that''s at the center. A domino. If that changed, everything else could. What is it for you?",
    "placeholder": "If I changed... everything else would shift because... the one thing that''s at the center of what I want to change is..."
  }
]'::jsonb
WHERE month_key = 'sep';

-- OCTOBER — What You're Still Carrying
UPDATE monthly_themes SET questions = '[
  {
    "label": "What are you still grieving?",
    "text": "Not just loss — the version of your life that didn''t happen. The relationship that ended. The path not taken. The person you thought you''d be by now. What are you still quietly grieving?",
    "placeholder": "I''m still grieving... I thought by now I would have... there''s a version of my life I let go of and haven''t fully mourned..."
  },
  {
    "label": "What would you put down if you knew it was allowed?",
    "text": "Something heavy you''ve been carrying — guilt, resentment, a version of yourself you can''t forgive, a relationship you''re still managing emotionally. What would you put down if someone told you it was okay?",
    "placeholder": "I''d put down the guilt about... I''d put down the responsibility for [name''s] feelings. I''d stop carrying the story that I should have..."
  },
  {
    "label": "Who are you without this weight?",
    "text": "Imagine — for just a moment — that it''s lighter. Not solved, not gone, but lighter. What do you have energy for that you don''t now? How do you move differently? What comes back?",
    "placeholder": "Without this weight, I think I''d laugh more. I''d be softer with [name]. I''d have energy for... the version of me that isn''t carrying this would..."
  }
]'::jsonb
WHERE month_key = 'oct';

-- NOVEMBER — Enough, Already
UPDATE monthly_themes SET questions = '[
  {
    "label": "What do you believe you still need to earn?",
    "text": "Rest, love, success, joy, respect — something you give yourself only after you''ve done enough, been enough, proved enough. What are the conditions you set for yourself before you''re allowed to have it?",
    "placeholder": "I let myself rest only after... I feel like I''ve earned love when... I''ll believe I''m enough when I finally..."
  },
  {
    "label": "Who taught you that you had to earn it?",
    "text": "This belief came from somewhere — a parent''s conditional approval, a culture of productivity, a relationship where you had to perform to be loved. Can you see where it started?",
    "placeholder": "I think I learned this from... there was a message in my family that... praise came when I..."
  },
  {
    "label": "What would you do, feel, or allow if you were already enough — right now, today?",
    "text": "Not when you''ve finished the project, fixed the relationship, lost the weight. Right now, as you are. What would you do differently if there were nothing left to prove?",
    "placeholder": "I would stop apologizing for... I would let myself want... I would allow [name] to love me without... I wouldn''t explain myself when..."
  }
]'::jsonb
WHERE month_key = 'nov';

-- DECEMBER — The Person Who Made It Here
UPDATE monthly_themes SET questions = '[
  {
    "label": "Who are you now that you weren''t at the start of this year?",
    "text": "Not what you accomplished — who you became. What shifted in how you see yourself, how you move, what you''re willing to say or refuse? Name the change, even if it''s small.",
    "placeholder": "I''m more... I stopped apologizing for... I finally said [something] to [name]. The biggest shift in who I am this year is..."
  },
  {
    "label": "What did you survive that you didn''t think you would?",
    "text": "Something hard — a loss, a transition, a version of yourself you had to let die — that you got through. You''re on the other side of it. What was it?",
    "placeholder": "I made it through... I didn''t think I would survive that period but I did. What it taught me about myself was..."
  },
  {
    "label": "Who do you want to be when this year becomes a memory?",
    "text": "A year from now, looking back — what do you want to have started? Who do you want to have become? Not the goals. The feeling of having been someone you''re proud of.",
    "placeholder": "I want to look back and know that I finally... that I was the kind of person who... that [name] experienced me as... that I stopped waiting for..."
  }
]'::jsonb
WHERE month_key = 'dec';

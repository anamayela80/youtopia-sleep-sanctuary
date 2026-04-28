-- Update April theme questions to structured format {label, text, placeholder}
-- Theme: "What You're Allowed to Want"

UPDATE monthly_themes
SET questions = '[
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

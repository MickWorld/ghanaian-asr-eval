"""Seed the prompt list on first launch (only when the prompts table is empty).

These are *elicitation topics*, not scripts: the speaker says a natural
sentence about the topic in the target language, then types exactly what was
said as the reference. Native, natural speech beats read-aloud scripts, and
it avoids baking in anyone else's (possibly wrong) orthography.
"""

from .db import connect

SEED = [
    # (language, category, topic)
    ("twi", "greetings", "Greet someone in the morning and ask how their family is doing"),
    ("twi", "greetings", "Welcome a visitor to your home and offer them water"),
    ("twi", "transport", "Tell a trotro mate where you are getting off and ask the fare"),
    ("twi", "transport", "Describe how to get from Circle to Madina by trotro"),
    ("twi", "mobile money", "Explain that you want to send mobile money to your mother"),
    ("twi", "mobile money", "Complain that a MoMo transaction failed and you were charged"),
    ("twi", "market", "Bargain for tomatoes at the market   the price is too high"),
    ("twi", "food", "Describe your favourite meal and how it is prepared"),
    ("twi", "proverbs", "Say a common Twi proverb and briefly explain what it means"),
    ("twi", "proverbs", "Say another proverb your grandmother used to say"),

    ("ewe", "greetings", "Greet someone in the morning and ask how their family is doing"),
    ("ewe", "greetings", "Welcome a visitor to your home and offer them water"),
    ("ewe", "transport", "Tell a driver where you are going and ask the fare"),
    ("ewe", "mobile money", "Explain that you want to send mobile money to a relative"),
    ("ewe", "market", "Bargain for fish at the market   the price is too high"),
    ("ewe", "food", "Describe your favourite meal and how it is prepared"),
    ("ewe", "proverbs", "Say a common Ewe proverb and briefly explain what it means"),
    ("ewe", "daily life", "Describe what you did yesterday from morning to evening"),

    ("cs", "work", "Talk about a work meeting the way you naturally would with a colleague (Twi + English mixed)"),
    ("cs", "tech", "Explain a phone or internet problem the way you would to a friend"),
    ("cs", "money", "Discuss prices or budgeting, mixing Twi and English naturally"),
    ("cs", "plans", "Make weekend plans with a friend the way you actually speak in Accra"),
    ("cs", "school", "Talk about a course or exam, mixing languages naturally"),
    ("cs", "directions", "Give someone directions to a place in Accra, mixing naturally"),
]


def seed_prompts() -> None:
    with connect() as conn:
        count = conn.execute("SELECT COUNT(*) FROM prompts").fetchone()[0]
        if count:
            return
        conn.executemany(
            "INSERT INTO prompts (language, category, text, position) VALUES (?, ?, ?, ?)",
            [(lang, cat, text, i) for i, (lang, cat, text) in enumerate(SEED)],
        )

import json
import os
from datetime import datetime, timedelta

SUGGESTIONS_FILE = 'suggestions.json'

# Sample suggestions to demonstrate the feature
sample_suggestions = [
    {
        'id': 1,
        'name': 'Sarah Johnson',
        'email': 'sarah@example.com',
        'suggestion': 'Great tool! It would be helpful to have a batch compression feature where I can compress multiple PDFs at once.',
        'timestamp': (datetime.now() - timedelta(days=5)).isoformat()
    },
    {
        'id': 2,
        'name': 'Mike Chen',
        'email': 'mike@example.com',
        'suggestion': 'The merge feature is excellent! Could you add an option to rearrange the order of PDFs before merging?',
        'timestamp': (datetime.now() - timedelta(days=3)).isoformat()
    },
    {
        'id': 3,
        'name': 'Emily Davis',
        'email': '',
        'suggestion': 'Love the interface! It would be great to see compression statistics like pages reduced or quality settings.',
        'timestamp': (datetime.now() - timedelta(days=2)).isoformat()
    },
    {
        'id': 4,
        'name': 'David Wilson',
        'email': 'david@example.com',
        'suggestion': 'The website works perfectly! Maybe add a feature to split PDFs into separate files?',
        'timestamp': (datetime.now() - timedelta(days=1)).isoformat()
    },
    {
        'id': 5,
        'name': 'Anonymous',
        'email': '',
        'suggestion': 'Very fast compression! Could you add support for password-protected PDFs?',
        'timestamp': (datetime.now() - timedelta(hours=12)).isoformat()
    }
]

# Initialize suggestions file with sample data
if not os.path.exists(SUGGESTIONS_FILE):
    with open(SUGGESTIONS_FILE, 'w') as f:
        json.dump({'suggestions': sample_suggestions}, f, indent=2)
    print(f"Created {SUGGESTIONS_FILE} with {len(sample_suggestions)} sample suggestions")
else:
    # Add sample suggestions if they don't exist
    with open(SUGGESTIONS_FILE, 'r') as f:
        data = json.load(f)
    
    existing_ids = {s['id'] for s in data.get('suggestions', [])}
    new_suggestions = [s for s in sample_suggestions if s['id'] not in existing_ids]
    
    if new_suggestions:
        data['suggestions'].extend(new_suggestions)
        with open(SUGGESTIONS_FILE, 'w') as f:
            json.dump(data, f, indent=2)
        print(f"Added {len(new_suggestions)} new sample suggestions")
    else:
        print("Sample suggestions already exist")


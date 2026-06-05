import os
import json
import urllib.request
import urllib.parse

def get_access_token(service_account_email, private_key_str):
    from google.oauth2 import service_account
    import google.auth.transport.requests
    
    info = {
        "type": "service_account",
        "client_email": service_account_email,
        "private_key": private_key_str,
        "token_uri": "https://oauth2.googleapis.com/token"
    }
    creds = service_account.Credentials.from_service_account_info(
        info, scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )
    auth_req = google.auth.transport.requests.Request()
    creds.refresh(auth_req)
    return creds.token

def main():
    env = {}
    if os.path.exists('.env.local'):
        with open('.env.local', 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    env[k.strip()] = v.strip().strip('"').strip("'")
                    
    sheet_id = env.get("GOOGLE_SHEET_ID")
    email = env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL")
    pkey = env.get("GOOGLE_PRIVATE_KEY", "").replace("\\n", "\n")
    
    token = get_access_token(email, pkey)
    
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{sheet_id}/values/Resultados_Input!A1:I200"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req) as f:
        res = json.loads(f.read().decode('utf-8'))
        rows = res.get("values", [])
        
        print("ALL OPEN GAMES (with empty scores):")
        found = False
        for idx, row in enumerate(rows[2:]): # Skip headers
            if len(row) >= 5:
                gId = row[0]
                semana = row[1]
                fecha = row[2]
                home = row[3]
                away = row[4]
                
                # Check if score is empty or hyphen
                score_home = row[5] if len(row) > 5 else ""
                score_away = row[6] if len(row) > 6 else ""
                
                # If both scores are empty or spaces/hyphens
                sh = str(score_home).strip()
                sa = str(score_away).strip()
                if not sh or not sa or sh == "-" or sa == "-":
                    print(f"Row {idx + 3} | ID: {gId} | {semana} | {fecha} | Matchup: {home} vs {away}")
                    found = True
        if not found:
            print("No open games found!")

if __name__ == "__main__":
    main()

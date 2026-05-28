# Vercel hängt in „Queued" — Plan

Lovable kann Vercel-Deploys weder triggern noch abbrechen. Wenn ein Commit auf `main` landet, Vercel aber gar nicht baut, liegt es zu 95 % an **Webhook / Git-Integration / Account-Limit**, nicht am Code. Plan: erst extern verifizieren, dann (falls nötig) einen minimalen Repo-Trigger als Fallback.

## Schritt 1 — Außerhalb des Repos prüfen (du, ~3 min)

1. **GitHub → Repo → Settings → Webhooks**
   Ist der Vercel-Webhook grün (letzte Delivery 200 OK)? Wenn rot/grau → Vercel-GitHub-App neu autorisieren (GitHub → Settings → Applications → Vercel → Configure → Repo-Zugriff erneuern).
2. **Vercel → Project → Settings → Git**
   - Richtiges Repo verbunden?
   - Production Branch = `main` (nicht `master`)?
   - „Ignored Build Step" leer oder `exit 1`?
3. **Vercel → Dashboard (oberer Banner)**
   Hobby-Plan: 100 Deploys/Tag, parallele Builds limitiert. Banner zeigt Throttling.
4. **Vercel → Project → Deployments**
   Steht der letzte Commit dort als „Queued", „Skipped", oder fehlt er ganz?
   - **Fehlt komplett** → Webhook-Problem (Schritt 1).
   - **„Skipped"** → Ignored Build Step / Branch-Filter.
   - **„Queued" > 5 min** → Vercel-Plattform-Incident (status.vercel.com) oder Account-Limit.

## Schritt 2 — Repo-seitiger Fallback (nur wenn Schritt 1 nichts findet)

Falls Webhook ok ist aber Builds trotzdem nicht starten, kann ein leerer Commit / Re-Trigger helfen — das machst du lokal, nicht Lovable:
```bash
git commit --allow-empty -m "chore: retrigger vercel"
git push origin main
```
Alternativ in Vercel: **Deployments → letzten Commit → … → Redeploy**.

## Schritt 3 — Optional: GitHub Action als Deploy-Trigger

Wenn die GitHub↔Vercel-Integration dauerhaft unzuverlässig ist, ersetze sie durch einen direkten Deploy-Hook:
1. Vercel → Project → Settings → Git → **Deploy Hooks** → neuen Hook für `main` erstellen, URL kopieren.
2. Hook-URL als GitHub Secret `VERCEL_DEPLOY_HOOK` hinterlegen.
3. `.github/workflows/vercel-deploy.yml` (kann ich im Build-Modus anlegen):
   ```yaml
   on: { push: { branches: [main] } }
   jobs:
     trigger:
       runs-on: ubuntu-latest
       steps:
         - run: curl -X POST "${{ secrets.VERCEL_DEPLOY_HOOK }}"
   ```
   Das umgeht die Vercel-GitHub-App komplett.

## Was ich (Lovable) im Build-Modus tun kann

- Workflow-Datei aus Schritt 3 anlegen.
- `vercel.json` aufräumen falls du Functions reduzieren willst (z.B. `api/_lib/**` Include prüfen).
- Sonst: nichts. Die Queue-Blockade selbst muss in Vercel/GitHub gelöst werden.

## Empfehlung

Erst **Schritt 1** durchgehen und mir zurückmelden, was du in **Vercel → Deployments** für den letzten Commit siehst (Queued? Skipped? Fehlt?). Davon hängt ab, ob wir Schritt 3 brauchen oder die Sache mit einem Webhook-Reauth erledigt ist.

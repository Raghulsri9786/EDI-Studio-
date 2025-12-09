<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# EDI Insight AI Studio App

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1tKBPiLm0q94wbfttReIxcafUuCIbHOLA

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Project Maintenance

To keep the project lightweight (<10MB) for cloud deployment, the following C#/.NET development folders are **not required** and should be deleted:

- `X12.NET-master/`
- `EDIFACT.NET-master/`
- `HL7.NET/`
- `NCPDP.NET/`
- `SCRIPT.NET/`
- `VDA.NET/`
- `FlatFile.NET/`
- `EdiFabric.Sdk/`
- `NET 6/`
- `NET Framework 4.8/`
- `packages/`
- `Files/`

You can delete these automatically by running:
```bash
npm run cleanup
```

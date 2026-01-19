# Owly Editor: Production Deployment Plan

This document outlines the strategy for integrating the **Owly Editor** into the Owly Studio production ecosystem.

## Primary Rendering Strategy: Google Cloud Run (Option B)

For the initial production phase, we recommend **Google Cloud Run** to keep the infrastructure strictly within the Google Cloud / GCS ecosystem.

### Infrastructure Overview
- **UI & Editor**: Hosted on **Vercel** (connects to this repository).
- **Rendering Workers**: **Google Cloud Run** (On-demand serverless containers).
- **Asset Storage**: **Google Cloud Storage (GCS)** for video tracks, manifests, and final exports.

### Setup Instructions

#### 1. Setup Cloud Run Worker
From this directory, run the following commands once your GCP CLI is authenticated:

```bash
# Install the Remotion Cloud Run bridge
npm install @remotion/cloudrun

# Deploy the specialized rendering container
npx remotion cloudrun services deploy --region=us-central1

# Upload the editor project code as a "Site" to GCS
npx remotion cloudrun sites create src/index.ts --site-name=owly-editor-v1
```

#### 2. Connect from Main App (Vercel)
Install the helper package in your main frontend:
`npm install @remotion/cloudrun`

Add the following API route to your Next.js project to trigger renders:

```typescript
import { renderMediaOnCloudrun } from "@remotion/cloudrun";

export async function POST(req: Request) {
  const { manifest } = await req.json();

  const { renderId, bucketName } = await renderMediaOnCloudrun({
    region: "us-central1",
    serviceName: "remotion-render-service",
    serveUrl: "https://storage.googleapis.com/YOUR_BUCKET/index.html",
    inputProps: { manifest },
  });

  return Response.json({ renderId, url: `gs://${bucketName}/renders/${renderId}` });
}
```

## Performance & Cost
- **On-Demand**: $0.00 cost when idle.
- **Estimated Render Cost**: ~$0.01 - $0.05 per 1-minute video.
- **Scalability**: Auto-scales based on user demand.

## Maintenance
- Updates to the editor UI only require a `git push` to Vercel.
- Updates to the rendering logic require a redeploy of the "Site" using the command in step 1.

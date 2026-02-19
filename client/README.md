# Client Frontend (React + Vite)

This frontend renders the public-facing catering site, including service menus, inquiry modal flow, landing slides, and the Showcase media gallery.

## Run Locally

```powershell
cd client
npm install
npm run dev
```

Frontend defaults to `http://localhost:5173` and proxies `/api` to `http://localhost:5000`.

## Routes

- `/` home/landing page with carousel slides from `GET /api/slides`
- `/services/:menuKey` dynamic service menu pages
- `/showcase` photo/video gallery page with modal viewer

## Showcase Gallery

The Showcase page (`client/src/components/ShowcaseGallery.jsx`) loads media from `GET /api/gallery`.

Expected API shape:

```json
{
  "media": [
    {
      "id": 11,
      "src": "/api/assets/slides/20231114_152614.jpg",
      "thumbnail_src": "/api/assets/slides/20231114_152614.jpg",
      "title": "Community Dinner",
      "caption": "Seasonal favorites",
      "alt": "Community dinner service line",
      "media_type": "image",
      "is_slide": true
    }
  ]
}
```

Behavior:

- Landing slides are sourced from `GET /api/slides` and can link into `/showcase?media=<id>`.
- In Showcase modal:
  - `image` media uses large contained rendering.
  - `video` media uses native playback controls.
- Modal supports previous/next navigation.

## Testing

```powershell
cd client
npm run test
```

Current component tests include:

- `src/components/Landing.test.jsx`
- `src/components/ShowcaseGallery.test.jsx`
- `src/components/SiteNavigation.test.jsx`
- `src/components/Inquiry.test.jsx`

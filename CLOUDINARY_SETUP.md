Cloudinary upload provider setup

To use Cloudinary as the Strapi upload provider:

1. Install the Cloudinary provider dependency:

```bash
npm install @strapi/provider-upload-cloudinary
```

2. Set environment variables (see `.env.example`):

```bash
export CLOUDINARY_NAME=your-cloud-name
export CLOUDINARY_KEY=your-api-key
export CLOUDINARY_SECRET=your-api-secret
export CLOUDINARY_FOLDER=engrave
```

3. Restart Strapi:

```bash
npm run develop
```

4. Verify upload works by using the admin UI or upload via curl:

```bash
curl -X POST "http://localhost:1337/api/upload" \
  -H "Authorization: Bearer $STRAPI_API_TOKEN" \
  -F "files=@/path/to/local/image.jpg"
```

If successful, the response will include the uploaded media object containing the Cloudinary URL.

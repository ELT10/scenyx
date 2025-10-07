# Quick Start Guide

Get up and running with the Sora 2 Video Generator in 3 simple steps!

## Step 1: Install Dependencies

```bash
cd /Users/eltonthomas/Developer/sora2
npm install
```

This will install all required packages:
- Next.js 14
- React 18
- OpenAI SDK
- TypeScript
- Tailwind CSS

## Step 2: Configure Your API Key

Create a `.env.local` file in the root directory:

```bash
echo "OPEN_API_KEY=your-openai-api-key-here" > .env.local
```

Or manually create the file with:
```
OPEN_API_KEY=sk-your-actual-api-key-here
```

**Where to get your API key:**
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign in to your account
3. Navigate to API Keys section
4. Create a new API key
5. Make sure your account has Sora 2 access

## Step 3: Run the Application

```bash
npm run dev
```

The application will start on [http://localhost:3000](http://localhost:3000)

## Testing the Application

1. Open your browser and navigate to `http://localhost:3000`
2. You should see a debug panel showing:
   - Prompt length
   - Loading status
   - Button state
3. Type a prompt like: "A serene sunset over a mountain range"
4. Click "Generate Video" or press Enter
5. Wait 1-2 minutes for the video to generate
6. The video will appear below once completed

## Troubleshooting

### Button is disabled
- Check the debug panel (only visible in development mode)
- Make sure you've typed something in the prompt field
- The button should enable once you type any text

### API Key Error
```
Error: OpenAI API key is not configured
```
**Solution:** Make sure you created `.env.local` with your API key

### Video Generation Fails
```
Error: Video generation failed with status: failed
```
**Possible causes:**
1. Invalid API key
2. No Sora 2 access on your account
3. Rate limit exceeded
4. Invalid prompt

**Solution:** Check the browser console (F12) for detailed error messages

### TypeScript Errors
If you see TypeScript errors about `videos` property:
- The custom type definitions are in `/types/openai.d.ts`
- Make sure TypeScript can find them (should work automatically)
- Try restarting your IDE/editor

## What's Next?

Once you have the application running:

1. **Customize the UI**: Edit `/app/page.tsx` to change the design
2. **Add Features**: Implement video history, multiple model support, etc.
3. **Deploy**: Build and deploy to Vercel, Netlify, or your preferred platform

## Resources

- Full README: [README.md](./README.md)
- API Documentation: [API_REFERENCE.md](./API_REFERENCE.md)
- OpenAI Docs: [https://platform.openai.com/docs](https://platform.openai.com/docs)

## Common Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Need Help?

- Check the browser console (F12) for errors
- Review the terminal output where you ran `npm run dev`
- Ensure your API key has Sora 2 access
- Check OpenAI's status page for service issues

---

Happy video generating! 🎥✨


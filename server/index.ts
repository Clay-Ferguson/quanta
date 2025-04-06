import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// API routes
app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// API routes - add your custom endpoints here
app.get('/api/data', (req: Request, res: Response) => {
    res.json({ message: 'This is data from the API' });
});

// Serve static files from the dist directory (client application)
const distPath = path.join(__dirname, '../../dist');
app.use(express.static(distPath));

// All other GET requests not handled before will return the React app
app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.resolve(distPath, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
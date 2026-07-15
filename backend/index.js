require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this-later';

// Auth middleware - protects routes, attaches req.userId
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.post('/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, passwordHash } });
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Create application
app.post('/applications', authMiddleware, async (req, res) => {
  try {
    const { company, role, status, jobUrl, notes } = req.body;
    if (!company || !role) {
      return res.status(400).json({ error: 'Company and role are required' });
    }
    const application = await prisma.application.create({
      data: {
        userId: req.userId,
        company,
        role,
        status: status || 'Applied',
        jobUrl: jobUrl || null,
        notes: notes || null,
      },
    });
    res.status(201).json(application);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// List applications for logged-in user
app.get('/applications', authMiddleware, async (req, res) => {
  try {
    const applications = await prisma.application.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(applications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Update application (e.g. change status)
app.patch('/applications/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.application.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.userId) {
      return res.status(404).json({ error: 'Application not found' });
    }
    const { company, role, status, jobUrl, notes } = req.body;
    const updated = await prisma.application.update({
      where: { id },
      data: {
        ...(company && { company }),
        ...(role && { role }),
        ...(status && { status }),
        ...(jobUrl !== undefined && { jobUrl }),
        ...(notes !== undefined && { notes }),
      },
    });
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Delete application
app.delete('/applications/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.application.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.userId) {
      return res.status(404).json({ error: 'Application not found' });
    }
    await prisma.application.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
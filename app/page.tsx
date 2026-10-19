'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import {
  ArrowRight,
  Check,
  ChevronRight,
  Menu,
  Sparkles,
  Users,
  Zap,
  Globe,
  Layers,
  X,
  LogOut,
  ShieldCheck,
  Clock,
} from 'lucide-react'
import { createClient } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { MARKET_FACTS } from '../lib/marketFacts'
import { MarketCite } from '../components/MarketCite'
import Brand from '../components/Brand'

const fallbackServices = [
  ['Video Editing', 'Reels, TikTok, Shorts, ads & long-form content.'],
  ['Graphic Design', 'Branding, social creatives, ads & marketing assets.'],
  ['Web Design', 'Modern landing pages, stores and conversion-focused websites.'],
  ['Social Media Content', 'Content systems built to keep brands consistent.'],
  ['UGC Content', 'Authentic creator content designed to drive action.'],
  ['Copywriting', 'Hooks, scripts, landing pages and sales copy.'],
  ['Branding', 'Visual identities that make businesses memorable.'],
  ['Motion Graphics', 'Animated visuals, promos and high-impact content.'],
]

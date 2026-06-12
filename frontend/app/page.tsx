'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { Mic, Upload, TrendingUp, Wallet, IndianRupee, Video } from 'lucide-react';
import Link from 'next/link';

const COLORS = ['#D97706', '#F59E0B', '#065F46', '#10B981', '#78716C'];

const sampleData = {
  totalExpenses: 51000,
  totalIncome: 85000,
  savings: 34000,
  byCategory: [
    { name: 'Education', value: 20000 },
    { name: 'Medical', value: 8000 },
    { name: 'EMI', value: 22000 },
    { name: 'Rent', value: 25000 },
    { name: 'Utilities', value: 2500 },
  ],
  monthlyTrend: [
    { month: 'Jan', amount: 45000 },
    { month: 'Feb', amount: 48000 },
    { month: 'Mar', amount: 51000 },
  ],
};

export default function Dashboard() {
  const [mode, setMode] = useState(0);
  const [data, setData] = useState(sampleData);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-white/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-display font-bold text-primary"
          >
            HisabVani
          </motion.h1>
          
          <nav className="flex gap-6">
            <Link href="/" className="text-foreground hover:text-primary transition-colors font-medium">
              Dashboard
            </Link>
            <Link href="/expense" className="text-foreground hover:text-primary transition-colors font-medium">
              Voice Khata
            </Link>
            <Link href="/voice" className="text-foreground hover:text-primary transition-colors font-medium">
              Voice Query
            </Link>
            <Link href="/upload" className="text-foreground hover:text-primary transition-colors font-medium">
              Upload Bill
            </Link>
            <Link href="/video" className="text-foreground hover:text-primary transition-colors font-medium">
              Video Reports
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Mode Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 bg-white rounded-2xl shadow-sm border border-border p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-display font-semibold">Response Style</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted">Detailed</span>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.1"
                value={mode}
                onChange={(e) => setMode(parseFloat(e.target.value))}
                className="w-48 h-2 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <span className="text-sm text-muted">Simple</span>
            </div>
          </div>
          <p className="text-sm text-muted">
            {mode > 0.5 ? '👨‍👩‍👧 Mom Mode: Simple, warm explanations' : 
             mode < -0.5 ? '📊 Detailed Mode: Precise percentages and analysis' : 
             '⚖️ Balanced Mode'}
          </p>
        </motion.div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[
            { label: 'Total Income', value: data.totalIncome, icon: Wallet, color: 'text-secondary' },
            { label: 'Total Expenses', value: data.totalExpenses, icon: TrendingUp, color: 'text-primary' },
            { label: 'Savings', value: data.savings, icon: IndianRupee, color: 'text-secondary' },
          ].map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="bg-white rounded-2xl shadow-sm border border-border p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-muted mb-1">{card.label}</p>
                  <p className="text-3xl font-display font-bold text-foreground">
                    ₹{card.value.toLocaleString('en-IN')}
                  </p>
                </div>
                <card.icon className={`w-8 h-8 ${card.color}`} />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl shadow-sm border border-border p-6"
          >
            <h3 className="text-xl font-display font-semibold mb-6">Expenses by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.byCategory}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {data.byCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Bar Chart */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            className="bg-white rounded-2xl shadow-sm border border-border p-6"
          >
            <h3 className="text-xl font-display font-semibold mb-6">Monthly Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.monthlyTrend}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="amount" fill="#D97706" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          <Link href="/expense" className="group">
            <div className="bg-gradient-to-br from-amber-600 via-primary to-primary-light rounded-2xl p-8 text-white hover:shadow-lg transition-all hover:scale-[1.02] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <Mic className="w-12 h-12 mb-4 relative z-10" />
              <h3 className="text-2xl font-display font-bold mb-2 relative z-10">Voice Khata</h3>
              <p className="text-white/90 relative z-10">Bol ke kharcha likho — instant voice expense logging</p>
            </div>
          </Link>
          
          <Link href="/voice" className="group">
            <div className="bg-gradient-to-br from-primary to-primary-light rounded-2xl p-8 text-white hover:shadow-lg transition-all hover:scale-[1.02]">
              <Mic className="w-12 h-12 mb-4" />
              <h3 className="text-2xl font-display font-bold mb-2">Ask a Question</h3>
              <p className="text-white/90">Speak in Hinglish, Hindi, Kannada, or Tamil</p>
            </div>
          </Link>
          
          <Link href="/upload" className="group">
            <div className="bg-gradient-to-br from-secondary to-emerald-600 rounded-2xl p-8 text-white hover:shadow-lg transition-all hover:scale-[1.02]">
              <Upload className="w-12 h-12 mb-4" />
              <h3 className="text-2xl font-display font-bold mb-2">Upload Bill</h3>
              <p className="text-white/90">Extract data from receipts and statements</p>
            </div>
          </Link>

          <Link href="/video" className="group">
            <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl p-8 text-white hover:shadow-lg transition-all hover:scale-[1.02]">
              <Video className="w-12 h-12 mb-4" />
              <h3 className="text-2xl font-display font-bold mb-2">Video Reports</h3>
              <p className="text-white/90">Generate shareable expense videos</p>
            </div>
          </Link>
        </motion.div>
      </main>
    </div>
  );
}

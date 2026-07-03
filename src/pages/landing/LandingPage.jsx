import { useEffect, useState } from 'react'
import './landing.css'

const marqueeItems = [
  'SMART STACKS',
  'STOCKOUT PREDICTION',
  'HEALTH SCORE',
  'SUPPLIER RELIABILITY',
  'DEAD STOCK DETECTION',
  'AI ASSISTANT',
  'MULTI-WAREHOUSE',
  'ROLE-BASED ACCESS',
  'MOVE HISTORY',
  'REAL-TIME LEDGER',
]

const techCards = [
  { icon: '⚛', name: 'React + Vite', desc: 'Fast, modular frontend with instant dev feedback.' },
  { icon: '🟢', name: 'Node.js + Express', desc: 'REST backend for warehouse operations and flows.' },
  { icon: '🗄', name: 'MySQL + Normalized Schema', desc: 'Relational model for traceable stock movement.' },
  { icon: '🤖', name: 'Groq AI API', desc: 'Natural-language inventory assistant with actionable output.' },
  { icon: '🔐', name: 'JWT + RBAC', desc: 'Role-based access for Manager and Staff permissions.' },
  { icon: '🔌', name: 'REST API', desc: 'Clean endpoints powering receipts, deliveries, and analytics.' },
]

function MarqueeContent() {
  return (
    <div className="ci-marquee-row">
      {marqueeItems.map((item) => (
        <span key={item} className="ci-marquee-item">
          {item} <b>◆</b>
        </span>
      ))}
    </div>
  )
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll('.reveal'))
    if (!nodes.length) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('is-visible')
        })
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    )

    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="ci-page">
      <header className={`ci-nav ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="ci-container ci-nav-inner">
          <a href="#top" className="ci-logo">
            <span className="ci-pulse" />
            CoreInventory
          </a>
          <nav className="ci-links">
            <a href="#features">Features</a>
            <a href="#smart-stacks">Smart Stacks</a>
            <a href="#demo">Demo</a>
          </nav>
          <a href="/auth/login" className="ci-btn ci-btn-primary">
            Launch App
          </a>
        </div>
      </header>

      <main id="top">
        <section className="ci-hero ci-container reveal">
          <div className="ci-hero-copy">
            <span className="ci-badge">Odoo Hackathon 2025 · Built in 24hrs</span>
            <h1>
              The warehouse that <span>thinks ahead</span>
            </h1>
            <p>
              CoreInventory does not just record what happened. It predicts what is about to happen and tells
              you exactly what to do.
            </p>
            <div className="ci-actions">
              <a href="#demo" className="ci-btn ci-btn-primary">
                See Live Demo
              </a>
              <a
                href="https://github.com/kd19-byte/CoreInventory"
                target="_blank"
                rel="noreferrer"
                className="ci-btn ci-btn-ghost"
              >
                View on GitHub
              </a>
            </div>
            <div className="ci-micro-stats">
              <span>12 SQL tables</span>
              <span>5 unique features</span>
              <span>1 Health Score</span>
            </div>
          </div>

          <div className="ci-hero-visual">
            <div className="overview-glow">
              <article className="overview-card">
                <header>CoreInventory Highlights</header>
                <ul className="kpis">
                  <li>
                    <span>Smart Stacks for recurring orders</span>
                  </li>
                  <li>
                    <span>Stockout prediction for proactive planning</span>
                  </li>
                  <li>
                    <span>Role-based workflows across warehouse teams</span>
                  </li>
                </ul>
              </article>
              <div className="live-chip">
                <span className="ci-pulse" />
                Live Demo
              </div>
            </div>
          </div>
        </section>

        <section className="ci-marquee">
          <div className="ci-marquee-track">
            <MarqueeContent />
            <MarqueeContent />
          </div>
        </section>

        <section className="ci-problem ci-container reveal">
          <div>
            <p className="ci-eyebrow">Problem</p>
            <h2>Everyone tracks inventory. Nobody predicts it.</h2>
          </div>
          <div className="problem-cards">
            <article className="ci-card hover-lift">
              <span>⚡</span>
              <h3>Stockouts discovered too late</h3>
              <p>By the time someone notices, orders are already failing.</p>
            </article>
            <article className="ci-card hover-lift">
              <span>🔁</span>
              <h3>Same orders, every month</h3>
              <p>Warehouse staff re-enter identical receipts every single month.</p>
            </article>
            <article className="ci-card hover-lift">
              <span>📋</span>
              <h3>No single source of truth</h3>
              <p>Data gets split across Excel, registers, and WhatsApp threads.</p>
            </article>
          </div>
        </section>

        <section className="ci-features reveal" id="features">
          <div className="ci-container">
            <p className="ci-eyebrow">Features</p>
            <h2>Built beyond the spec.</h2>
            <p className="ci-subtitle">Every team has receipts. Here is what only CoreInventory has.</p>

            <div className="feature-grid">
              <article className="ci-card feature-card smart hover-lift">
                <span className="num">01</span>
                <h3>Smart Stacks</h3>
                <p>Save recurring monthly orders as named templates and execute every receipt in one click.</p>
                <pre>Sugar 50kg
Wheat 100kg
Oil 30L
Cold Drinks 24u</pre>
                <span className="tag warm">UNIQUE TO COREINVENTORY</span>
              </article>

              <article className="ci-card feature-card hover-lift">
                <span className="num">02</span>
                <h3>Stockout Prediction</h3>
                <p>Computes 30-day average daily consumption and shows exact days remaining per product.</p>
                <span className="tag">SQL-POWERED FORECAST</span>
              </article>

              <article className="ci-card feature-card hover-lift">
                <span className="num">03</span>
                <h3>Warehouse Health Score</h3>
                <p>Single 0-100 metric combining stock availability, fulfillment rate, and adjustment frequency.</p>
                <span className="tag">OPS SIGNAL</span>
              </article>

              <article className="ci-card feature-card hover-lift">
                <span className="num">04</span>
                <h3>Supplier Reliability</h3>
                <p>Tracks promised quantity vs received quantity and ranks vendor consistency by percentage.</p>
                <span className="tag">VENDOR INTELLIGENCE</span>
              </article>

              <article className="ci-card feature-card hover-lift">
                <span className="num">05</span>
                <h3>Dead Stock Detection</h3>
                <p>Automatically flags products with zero outgoing movements for 30+ days.</p>
                <span className="tag">WASTE CONTROL</span>
              </article>
            </div>
          </div>
        </section>

        <section className="ci-stack-dive ci-container reveal" id="smart-stacks">
          <div>
            <p className="ci-eyebrow">Smart Stacks</p>
            <h2>Order the same things every month? Never type them again.</h2>
            <p className="ci-subtitle">
              Smart Stacks convert repetitive procurement into an executable plan. Define once, execute monthly,
              and track due reminders directly from the dashboard.
            </p>
            <ol className="steps">
              <li>Create a named stack</li>
              <li>Add your recurring products + quantities</li>
              <li>One click executes and all receipts are generated as draft</li>
              <li>Dashboard reminds you when it is due</li>
            </ol>
          </div>

          <article className="ci-card stack-preview hover-lift">
            <div className="stack-head">
              <h3>Monthly Essentials</h3>
              <span className="tag">Monthly</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Order Qty</th>
                  <th>Current Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Sugar</td>
                  <td>50kg</td>
                  <td>3kg</td>
                  <td><span className="pill danger">LOW</span></td>
                </tr>
                <tr>
                  <td>Wheat Flour</td>
                  <td>100kg</td>
                  <td>42kg</td>
                  <td><span className="pill ok">OK</span></td>
                </tr>
                <tr>
                  <td>Cooking Oil</td>
                  <td>30L</td>
                  <td>8L</td>
                  <td><span className="pill danger">LOW</span></td>
                </tr>
                <tr>
                  <td>Cold Drinks</td>
                  <td>24u</td>
                  <td>18u</td>
                  <td><span className="pill ok">OK</span></td>
                </tr>
                <tr>
                  <td>Ice Cream</td>
                  <td>12u</td>
                  <td>2u</td>
                  <td><span className="pill danger">LOW</span></td>
                </tr>
              </tbody>
            </table>
            <button type="button">Execute Stack → 5 Receipts</button>
            <div className="stack-foot">
              <small>Last executed: 28 days ago</small>
              <span className="tag danger">OVERDUE 2 DAYS</span>
            </div>
          </article>
        </section>

        <section className="ci-stats reveal">
          <div className="ci-container ci-stats-grid">
            <article>
              <strong>12+</strong>
              <p>Normalized SQL tables</p>
            </article>
            <article>
              <strong>1-click</strong>
              <p>Execute full monthly reorder</p>
            </article>
            <article>
              <strong>4 days</strong>
              <p>Average stockout warning window</p>
            </article>
            <article>
              <strong>100%</strong>
              <p>Traceability on every stock movement</p>
            </article>
          </div>
        </section>

        <section className="ci-ai ci-container reveal">
          <div>
            <p className="ci-eyebrow">AI Inventory Assistant</p>
            <h2>Ask your warehouse anything</h2>
            <p className="ci-subtitle">
              Groq-powered intelligence lets your team ask plain-language questions and get operationally useful
              answers instantly.
            </p>
            <div className="query-pills">
              <span>What should I reorder first?</span>
              <span>Which supplier is most reliable?</span>
              <span>What&apos;s my biggest stock risk this week?</span>
            </div>
          </div>
          <article className="ci-card chat-box hover-lift">
            <div className="msg user">What products will run out this week?</div>
            <div className="msg ai">
              <div className="typing">
                <span />
                <span />
                <span />
              </div>
              <p>
                Based on current consumption rates:
                <br />
                · Steel Rods - 4 days remaining (critical)
                <br />
                · Sugar - 6 days remaining
                <br />
                · Cooking Oil - 8 days remaining
                <br />
                Recommend executing Monthly Essentials stack today.
              </p>
            </div>
            <div className="chat-input">Ask CoreInventory AI...</div>
          </article>
        </section>

        <section className="ci-tech ci-container reveal">
          <p className="ci-eyebrow">Tech Stack</p>
          <h2>What&apos;s under the hood</h2>
          <div className="tech-grid">
            {techCards.map((card) => (
              <article key={card.name} className="ci-card tech-card hover-lift">
                <span className="icon">{card.icon}</span>
                <h3>{card.name}</h3>
                <p>{card.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="ci-cta reveal" id="demo">
          <div className="ci-container">
            <h2>See it in action.</h2>
            <p>
              Built in 24 hours for Odoo Hackathon 2025. Designed for the warehouse that thinks ahead.
            </p>
            <div className="ci-actions center">
              <a href="/auth/login" className="ci-btn ci-btn-primary">
                Live Demo
              </a>
              <a
                href="https://github.com/kd19-byte/CoreInventory"
                target="_blank"
                rel="noreferrer"
                className="ci-btn ci-btn-ghost"
              >
                GitHub Repo
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="ci-footer">
        <div className="ci-container ci-footer-grid">
          <a href="#top" className="ci-logo">
            <span className="ci-pulse" />
            CoreInventory
          </a>
          <p>Built for Odoo Hackathon 2025 · React + Node.js + MySQL</p>
          <span />
        </div>
      </footer>
    </div>
  )
}

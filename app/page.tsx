import styles from './page.module.css'

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.description}>
        <h1>Why It Matters</h1>
        <p>Web app for generating and auto-posting Quiet Hours content</p>
      </div>

      <div className={styles.center}>
        <div className={styles.logo}>
          <h2>Welcome to Why It Matters</h2>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <h2>Getting Started</h2>
          <p>This is a Next.js application ready for Vercel deployment.</p>
        </div>

        <div className={styles.card}>
          <h2>Documentation</h2>
          <p>Find in-depth information about Next.js features and API.</p>
        </div>

        <div className={styles.card}>
          <h2>Deploy</h2>
          <p>Instantly deploy your Next.js site to a shareable URL with Vercel.</p>
        </div>
      </div>
    </main>
  )
}

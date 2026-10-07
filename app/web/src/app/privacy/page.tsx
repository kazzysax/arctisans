import type { Metadata } from "next";
import { Legal } from "@/components/Legal";

export const metadata: Metadata = { title: "Privacy Policy | Arctisans" };

export default function Privacy() {
  return (
    <Legal title="Privacy Policy" updated="7 October 2026">
      <section><h2>What we collect</h2><ul>
        <li><b>Sign-in:</b> your email address, or your Google account identity, handled through Circle. We do not see your password.</li>
        <li><b>Wallet:</b> the wallet address created for you. Addresses and transactions on Arc are public.</li>
        <li><b>Profile:</b> the name, handle, title, bio, skills, city, links and pictures you add.</li>
        <li><b>Content:</b> posts, images, videos, likes, follows, tips and reviews.</li>
        <li><b>Jobs:</b> job terms, job chat messages and deliveries. The agreement hash and payments are recorded on-chain and are public.</li>
        <li><b>Technical:</b> a session cookie that keeps you signed in, and basic request logs from our host.</li>
      </ul></section>
      <section><h2>What we use it for</h2><p>To run your account, show your profile and posts, carry out jobs and payments, let agents reply to you, send notifications inside the app, prevent abuse and keep the service working. We do not sell your data and we do not show ads.</p></section>
      <section><h2>Who else handles it</h2><ul>
        <li><b>Circle</b> creates your wallet and handles sign-in.</li>
        <li><b>Vercel</b> hosts the app and stores uploaded images and videos.</li>
        <li><b>Turso</b> stores our database.</li>
        <li><b>AI model providers</b> (through OpenRouter) read the text of a job and its chat so an AI agent can reply or do the work. Do not put secrets in a job.</li>
        <li><b>X and GitHub</b> are contacted only if you link them or post from X.</li>
      </ul></section>
      <section><h2>What is public</h2><p>Your handle, profile, posts, reputation figures, badges, wallet address and anything you do on-chain are public. Job chat messages are visible to the two sides of the job.</p></section>
      <section><h2>Cookies</h2><p>One session cookie keeps you signed in. We do not use advertising or tracking cookies.</p></section>
      <section><h2>Age</h2><p>Arctisans is for people aged 18 and over. If we learn that someone under 18 has an account we will remove it.</p></section>
      <section><h2>Your choices</h2><p>You can edit your profile, delete your posts and sign out at any time. To ask us to delete your account data, message @arctisans on X. We cannot delete anything recorded on-chain.</p></section>
      <section><h2>Changes and contact</h2><p>We will change the date above when this policy changes. Questions: message @arctisans on X.</p></section>
    </Legal>
  );
}

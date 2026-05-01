'use client'

import Link from 'next/link'
import Image from 'next/image'

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '#', label: 'Team' },
  { href: '#', label: 'Careers' },
  { href: '#', label: 'Whitepaaper' },
  { href: '#', label: 'Learn' },
]

const socialLinks = [
  { href: 'https://t.me', label: 'Telegram', icon: 'telegram' },
  { href: 'https://youtube.com', label: 'YouTube', icon: 'youtube' },
  { href: 'https://x.com/Heres_app', label: 'X (Twitter)', icon: 'x' },
  { href: 'https://github.com/Heres-Protocol/Heres-Protocol', label: 'GitHub', icon: 'github' },
  { href: 'https://discord.gg', label: 'Discord', icon: 'discord' },
]

const contactLinks = [
  { href: '#', label: 'Legal' },
  { href: '#', label: 'Privacy Policy' },
]

const joinLinks = [
  { href: 'https://discord.gg', label: 'Discord' },
  { href: 'https://x.com/Heres_app', label: 'Twitter' },
  { href: 'https://youtube.com', label: 'Youtube' },
  { href: 'https://t.me', label: 'Telegram' },
]

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21.9 4.6 18.7 20c-.2 1-.8 1.2-1.7.8l-4.8-3.5-2.3 2.2c-.2.2-.4.4-.9.4l.3-4.8 8.8-8c.4-.4-.1-.6-.5-.3l-10.8 6.8-4.7-1.5c-1-.3-1.1-1 .2-1.5L20 3.8c.9-.3 1.7.2 1.4.8Z" />
    </svg>
  )
}

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21.8 8s-.2-1.4-.8-2c-.8-.8-1.7-.8-2.1-.9C15.9 4.8 12 4.8 12 4.8h0s-3.9 0-6 .3c-.4.1-1.3.1-2.1.9C3.3 6.6 3.1 8 3.1 8S2.8 9.6 2.8 11.1v1.7c0 1.5.3 3.1.3 3.1s.2 1.4.8 2c.8.8 1.9.8 2.4.9 1.7.2 5.7.3 5.7.3s3.9 0 6-.3c.4-.1 1.3-.1 2.1-.9.6-.6.8-2 .8-2s.3-1.6.3-3.1v-1.7c0-1.5-.3-3.1-.3-3.1ZM9.9 14.3V8.9l5.2 2.7-5.2 2.7Z" />
    </svg>
  )
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5C5.6.5.5 5.7.5 12.1c0 5.1 3.3 9.5 7.8 11 .6.1.8-.3.8-.6v-2.3c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.3 1.8 1.3 1 .1 1.6 2.7 4.3 1.9.1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.9 0-1.3.5-2.3 1.2-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2 1-.3 2-.4 3-.4s2 .1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.9 1.2 1.9 1.2 3.2 0 4.6-2.7 5.6-5.3 5.9.4.3.8 1 .8 2v3c0 .3.2.7.8.6 4.6-1.5 7.8-5.9 7.8-11C23.5 5.7 18.4.5 12 .5Z" />
    </svg>
  )
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.5 5.6A15.9 15.9 0 0 0 15.7 4l-.2.4c1.5.4 2.2 1 2.8 1.4-1.2-.6-2.5-1-3.8-1.2-.8-.1-1.6-.2-2.5-.2-.8 0-1.7.1-2.5.2-1.3.2-2.6.6-3.8 1.2.6-.4 1.3-1 2.8-1.4L8.3 4a15.8 15.8 0 0 0-3.8 1.6C2.1 9.2 1.5 12.8 1.7 16.4c1.5 1.1 3 1.8 4.5 2.3l1.1-1.8c-.6-.2-1.2-.5-1.8-.9l.4-.3c3.4 1.6 7 1.6 10.4 0l.4.3c-.6.4-1.2.7-1.8.9l1.1 1.8c1.5-.5 3-1.2 4.5-2.3.3-4.1-.5-7.7-2.7-10.8ZM8.8 14.1c-.8 0-1.5-.8-1.5-1.7 0-.9.6-1.7 1.5-1.7.8 0 1.5.8 1.5 1.7 0 1-.7 1.7-1.5 1.7Zm6.4 0c-.8 0-1.5-.8-1.5-1.7 0-.9.6-1.7 1.5-1.7.8 0 1.5.8 1.5 1.7 0 1-.7 1.7-1.5 1.7Z" />
    </svg>
  )
}

export function Footer() {
  return (
    <footer className="bg-Heres-bg text-Heres-white">
      <div className="mx-auto max-w-[1320px] px-4 pb-10 pt-10 sm:px-6 lg:px-8">
        <section className="grid gap-8 lg:grid-cols-[1fr_470px] lg:items-end">
          <div>
            <p className="max-w-sm text-4xl font-semibold uppercase leading-[1.2] tracking-[-0.04em] text-white/45">
              Help us shape the future of Heres we value your input.
            </p>
          </div>
          <div className="rounded-[6px] bg-[#222632] p-4">
            <p className="mb-4 text-[18px] font-semibold text-white">Send Us Your Feedback</p>
            <div className="space-y-3">
              <input className="w-full rounded-[2px] bg-white px-4 py-2.5 text-sm text-black outline-none" placeholder="*Your Name" />
              <input className="w-full rounded-[2px] bg-white px-4 py-2.5 text-sm text-black outline-none" placeholder="*Your Email" />
              <textarea className="min-h-[86px] w-full rounded-[2px] bg-white px-4 py-2.5 text-sm text-black outline-none" placeholder="*Your feedback..." />
              <a href="mailto:hello@heresprotocol.com?subject=Heres%20Feedback" className="flex w-full items-center justify-center bg-[#3786c8] py-3 text-sm font-semibold text-white transition hover:opacity-90">
                SEND
              </a>
            </div>
          </div>
        </section>

        <div className="my-8 border-t border-Heres-border/50" />

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-[10px] bg-[#060b16] px-4 py-3">
              <Image src="/logo-white.png?v=3" alt="Heres" width={44} height={44} className="h-11 w-auto" unoptimized />
              <span className="text-xl font-semibold tracking-[-0.04em] text-Heres-white">HERES</span>
            </div>
            <div className="mt-4 flex gap-4 text-white">
              {socialLinks.map((item) => (
                <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer" aria-label={item.label} className="transition hover:text-cyan-300">
                  {item.icon === 'telegram' && <TelegramIcon className="h-6 w-6" />}
                  {item.icon === 'youtube' && <YoutubeIcon className="h-6 w-6" />}
                  {item.icon === 'x' && <XIcon className="h-6 w-6" />}
                  {item.icon === 'github' && <GithubIcon className="h-6 w-6" />}
                  {item.icon === 'discord' && <DiscordIcon className="h-6 w-6" />}
                </a>
              ))}
            </div>
            <p className="mt-8 text-[19px] font-semibold text-white">Be The First To Know</p>
            <div className="mt-4 max-w-[330px]">
              <input className="w-full rounded-full bg-white px-4 py-3 text-sm text-black outline-none" placeholder="Email" />
              <label className="mt-4 flex items-start gap-3 text-sm text-white">
                <span className="mt-0.5 h-7 w-7 border border-white/80 bg-transparent" />
                <span className="leading-5 text-white">
                  I agree to receive emails from Heres.
                  <br />
                  Unsubscribe anytime. <span className="text-blue-400">Privacy Policy</span>
                </span>
              </label>
              <button className="mt-3 rounded-[12px] border border-cyan-500 px-5 py-2 text-[28px]/none text-cyan-400 transition hover:bg-cyan-500/10">
                <span className="text-lg font-medium">Submit</span>
              </button>
            </div>
          </div>

          <div>
            <p className="text-[20px] font-semibold uppercase text-white">Heres</p>
            <div className="mt-6 space-y-5">
              {navLinks.map((item) => (
                <Link key={item.label} href={item.href} className="block text-[18px] text-white/95 transition hover:text-cyan-300">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[20px] font-semibold uppercase text-white">Contact Us</p>
            <div className="mt-6 space-y-5">
              {contactLinks.map((item) => (
                <a key={item.label} href={item.href} className="block text-[18px] text-white/95 transition hover:text-cyan-300">
                  {item.label}
                </a>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[20px] font-semibold uppercase text-white">Join Us</p>
            <div className="mt-6 space-y-5">
              {joinLinks.map((item) => (
                <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" className="block text-[18px] text-white/95 transition hover:text-cyan-300">
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-Heres-border/50 pt-5">
          <p className="text-[18px] text-white">
            Copyright 2026 <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/70 text-sm">C</span> HERES Protocol
          </p>
          <p className="mt-4 text-sm font-semibold underline underline-offset-4">All Rights Reserved</p>
        </div>

        <div className="mt-8 overflow-hidden">
          <p className="proto-footer-wordmark">HERES</p>
        </div>
      </div>
    </footer>
  )
}

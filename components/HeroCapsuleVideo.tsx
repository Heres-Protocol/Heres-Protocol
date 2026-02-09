'use client'

import { HeresPromoReel } from '@/components/HeresPromoReel'

type HeroCapsuleVideoProps = {
  /** Optional: path to MP4 (e.g. /hero-capsule.mp4). If set, video is shown. */
  videoMp4?: string
  /** Optional: path to WebM. */
  videoWebm?: string
  /** Poster image when video is loading (used only when video is provided). */
  posterSrc?: string
  alt?: string
  className?: string
}

/**
 * Hero section right panel: plays project-style video when videoMp4/videoWebm are provided,
 * otherwise shows the 15s Heres Promo Reel (timeline per spec).
 * To use a real video: add public/hero-capsule.mp4 and pass videoMp4="/hero-capsule.mp4".
 */
export function HeroCapsuleVideo({
  videoMp4,
  videoWebm,
  posterSrc = '/Heres-capsule-hero.png',
  alt = 'Heres capsule',
  className = '',
}: HeroCapsuleVideoProps) {
  const hasVideo = Boolean(videoMp4 || videoWebm)

  if (hasVideo && (videoMp4 || videoWebm)) {
    return (
      <video
        autoPlay
        loop
        muted
        playsInline
        className={`h-full w-full object-cover ${className}`}
        poster={posterSrc}
      >
        {videoMp4 && <source src={videoMp4} type="video/mp4" />}
        {videoWebm && <source src={videoWebm} type="video/webm" />}
      </video>
    )
  }

  return <HeresPromoReel className={`h-full w-full ${className}`} />
}

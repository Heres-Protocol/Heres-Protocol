'use client'

import Image from 'next/image'

type CapsuleMediaBlockProps = {
  posterSrc?: string
  videoMp4?: string
  videoWebm?: string
  alt?: string
  className?: string
  objectFit?: 'cover' | 'contain'
  withMotion?: boolean
}

export function CapsuleMediaBlock({
  posterSrc = '/Heres-capsule-hero.png',
  videoMp4,
  videoWebm,
  alt = 'Heres capsule',
  className = '',
  objectFit = 'cover',
  withMotion = true,
}: CapsuleMediaBlockProps) {
  const hasVideo = Boolean(videoMp4 || videoWebm)

  if (hasVideo && (videoMp4 || videoWebm)) {
    return (
      <video
        autoPlay
        loop
        muted
        playsInline
        className={`capsule-media-block ${withMotion ? 'capsule-media-motion' : ''} ${className}`}
        style={{ objectFit }}
        poster={posterSrc}
      >
        {videoMp4 && <source src={videoMp4} type="video/mp4" />}
        {videoWebm && <source src={videoWebm} type="video/webm" />}
      </video>
    )
  }

  return (
    <div
      className={`capsule-media-block capsule-media-poster ${withMotion ? 'capsule-media-motion' : ''} ${className}`}
    >
      <div className={`capsule-media-poster-inner ${objectFit === 'cover' ? '!max-w-none !max-h-none !w-full !h-full' : ''}`}>
        <Image
          src={posterSrc}
          alt={alt}
          fill
          className={objectFit === 'cover' ? 'object-cover' : 'object-contain'}
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </div>
    </div>
  )
}

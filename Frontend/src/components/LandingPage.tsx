import { useEffect } from 'react'

type LandingPageProps = {
  onLogin: () => void
  onSignup: () => void
}

const features = [
  {
    icon: '🗺️',
    title: 'Live Place Map',
    description:
      'Real-time heatmaps of activity in local social spots. See where the vibe is right before you even leave home.',
  },
  {
    icon: '🙂',
    title: 'Mood & Intent',
    description:
      "Express exactly what you're looking for—from a quick coffee chat to a deep philosophical debate.",
  },
  {
    icon: '🔒',
    title: 'Pseudonym Privacy',
    description:
      'Stay safe and comfortable with customizable handles and controlled profile visibility until you are ready.',
  },
  {
    icon: '⚡',
    title: 'Instant Ping',
    description:
      "Found someone interesting nearby? Send a digital wave to see if they're ready to bridge the gap to physical reality.",
  },
] as const

const testimonials = [
  {
    name: 'CuriousCat',
    place: 'At Blue Bottle Coffee',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuByRQA5uDsp7Kco8fQM_M5AchjfNGNj-h0l4WiQ81P0hSwHFlRaz4agHsMmLechhZoqNHAY39zAZIdLW1swrB0RkR3ljHR3hfj_kXCcVmjD1khuCppRWkxPw_er6wCpjGpuOvbS0OxNNbzHkA2H3EHuG20lobe4w6vRkHAbwKvMuqu-ps0Wr7pfNER4LH2OkSFxSNNtvZldX2qRWrDc0NcYbO0RJjf6Pst5Ykn9xFJzT2A-jqvNNNSA2tyDYsAzyDZgjYm4Rk7CbA',
    quote:
      'Finally an app that encourages me to actually put my phone away and talk to the person across the room.',
  },
  {
    name: 'CafePhilosopher',
    place: 'At Central Park',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAT6tzKzlpmPuRQaAghFkwhPsVST9ktFdw9tYqvk4gHAncagrtgUdLANcaHqYj2qV2gzVV_GWCc61HqROV3o7i2_LzyxLSu09lKtJt3dUfc8DHUnXpkvNJrTLFia3M0gA8LwJmNRlN4mJcW9ZmqXQlbuMXGNSIjnQ7-sau2TLKWUiRJQwaqk4rMePYAXhYoMEus23PxCTamqqmiY7mwFRZgrdsM8kJaxjS45_Q4UPcnha4_ocqucKL4xTgUqFVCpt6pFFxRm_RJWA',
    quote:
      "Met three new people today just by setting my status to 'Deep Talk'. It’s like a secret club for social humans.",
  },
  {
    name: 'UrbanExplorer',
    place: 'At Metro Hub',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDek7D93GtQ89QJ-NlYpLFRbXQg9828Br4IK7-St2fhfNwjh8uY-ny9CiysDFhQsMvI9XiQlEF7o2QNE4plTPQq23fpTHSpibbCOuZdIkYLip9CFaJOyn26clPnf71HZOnSEABTdL9fvMKFMVifzC65-OhscrEOGNf1nCeP7_er1HZBIxRe6dCLkotvL_voVyk4uQfQl97YYfUV8PCEl0dbjA5Nuf05WQmuXQ2fKiuHgRuxnpPBjnI8a25mz_n-pmSgbF2cKD4SOA',
    quote:
      'As an introvert, this is the perfect bridge. I know someone wants to talk before I ever say hello.',
  },
] as const

export function LandingPage({ onLogin, onSignup }: LandingPageProps) {
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('.lt-reveal-on-scroll'))
    const blobs = Array.from(document.querySelectorAll<HTMLElement>('.lt-hero-blob'))

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('active')
            if ((entry.target as HTMLElement).id === 'how-it-works') {
              entry.target.classList.add('reveal-line')
            }
          }
        })
      },
      { threshold: 0.15 },
    )

    sections.forEach((section) => observer.observe(section))

    const onScroll = () => {
      const scrolled = window.pageYOffset
      blobs.forEach((blob, index) => {
        blob.style.top = `${scrolled * 0.05 * (index + 1)}px`
      })
    }

    window.addEventListener('scroll', onScroll)

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#e9ffed] text-[#002111] selection:bg-[#6dfe9c] selection:text-[#00210c]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@300;600;700;800&display=swap');

        .lt-home {
          font-family: "Hanken Grotesk", "Avenir Next", "Trebuchet MS", "Segoe UI", sans-serif;
        }

        .lt-glass-nav {
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .lt-hero-blob {
          filter: blur(80px);
          opacity: 0.4;
          z-index: -1;
          animation: lt-organic-shift 25s infinite alternate ease-in-out;
        }

        @keyframes lt-organic-shift {
          0% { transform: translate(0, 0) scale(1) rotate(0deg); border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; }
          33% { transform: translate(120px, 40px) scale(1.15) rotate(15deg); border-radius: 50% 50% 33% 67% / 55% 27% 73% 45%; }
          66% { transform: translate(-60px, 80px) scale(0.9) rotate(-10deg); border-radius: 67% 33% 47% 53% / 37% 20% 80% 63%; }
          100% { transform: translate(50px, -20px) scale(1.1) rotate(5deg); border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; }
        }

        .lt-floating-card {
          animation: lt-float-bob 6s ease-in-out infinite;
        }

        @keyframes lt-float-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }

        .lt-step-line {
          background-image: linear-gradient(to right, #707a70 50%, transparent 50%);
          background-size: 10px 1px;
          background-repeat: repeat-x;
          width: 0;
          transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .reveal-line .lt-step-line {
          width: 16.666667%;
        }

        .lt-shimmer-btn {
          position: relative;
          overflow: hidden;
        }

        .lt-shimmer-btn::after {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.2), transparent);
          transform: rotate(30deg);
          animation: lt-shimmer 4s infinite;
        }

        @keyframes lt-shimmer {
          0% { transform: translateX(-150%) rotate(30deg); }
          20%, 100% { transform: translateX(150%) rotate(30deg); }
        }

        .lt-reveal-on-scroll {
          opacity: 0;
          transform: translateY(30px);
          transition: all 0.8s cubic-bezier(0.22, 1, 0.36, 1);
        }

        .lt-reveal-on-scroll.active {
          opacity: 1;
          transform: translateY(0);
        }

        .lt-btn-hover-glow:hover {
          box-shadow: 0 0 20px rgba(74, 222, 128, 0.4);
        }

        .lt-card-lift {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .lt-card-lift:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 40px rgba(0, 81, 41, 0.08);
        }

        @media (prefers-reduced-motion: reduce) {
          .lt-hero-blob,
          .lt-floating-card,
          .lt-shimmer-btn::after,
          .lt-reveal-on-scroll {
            animation: none !important;
            transition: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      <div className="lt-home">
        <nav className="lt-glass-nav sticky top-0 z-50 w-full border-b border-[#bfc9be]/15 bg-[#e9ffed]/80 shadow-sm">
          <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 md:px-10">
            <div className="flex items-center gap-1 text-2xl font-bold text-[#005129]">
              <span>LetsTalk</span>
              <span className="text-[#1a6b3c]">●</span>
            </div>

            <div className="hidden items-center gap-6 md:flex">
              <button
                type="button"
                onClick={onLogin}
                className="text-sm font-semibold tracking-[0.05em] text-[#404940] transition hover:scale-105 hover:text-[#005129] active:scale-95"
              >
                Log In
              </button>
              <button
                type="button"
                onClick={onSignup}
                className="lt-btn-hover-glow rounded-full bg-[#005129] px-6 py-2 text-sm font-semibold tracking-[0.05em] text-white transition-all hover:scale-105 hover:bg-[#005129]/90 active:scale-95"
              >
                Sign Up
              </button>
            </div>

            <button type="button" onClick={onLogin} className="p-2 text-[#005129] md:hidden">
              <span className="text-xl">≡</span>
            </button>
          </div>
        </nav>

        <main>
          <section className="lt-reveal-on-scroll relative flex min-h-[921px] items-center overflow-hidden px-5 py-12 md:px-10">
            <div className="lt-hero-blob absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-[#89d89e]" />
            <div
              className="lt-hero-blob absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-[#4de082]"
              style={{ animationDelay: '-5s' }}
            />

            <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
              <div className="space-y-6">
                <h1 className="text-5xl font-extrabold leading-tight tracking-[-0.02em] text-[#002111] md:text-[48px] md:leading-[56px]">
                  Find people ready to <span className="italic text-[#005129]">talk</span>, right where you are
                </h1>
                <p className="max-w-xl text-lg font-light leading-7 text-[#404940]">
                  Discover nearby cafes, parks &amp; venues where real conversations are happening right now. Skip the swiping, embrace the meeting.
                </p>
                <div className="flex flex-col gap-4 pt-4 sm:flex-row">
                  <button
                    type="button"
                    onClick={onSignup}
                    className="lt-shimmer-btn lt-btn-hover-glow flex items-center justify-center gap-2 rounded-full bg-[#005129] px-8 py-4 text-sm font-semibold uppercase tracking-[0.05em] text-white shadow-lg transition-all hover:scale-105 active:scale-95"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      Find Nearby Places
                      <span className="text-[18px]">→</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
                    }}
                    className="rounded-full border-2 border-[#005129] px-8 py-4 text-sm font-semibold uppercase tracking-[0.05em] text-[#005129] transition-all hover:scale-105 hover:bg-[#005129]/5 active:scale-95"
                  >
                    See How It Works
                  </button>
                </div>
              </div>

              <div className="relative flex justify-center lg:justify-end">
                <div className="lt-floating-card relative w-full max-w-md rounded-[32px] border border-[#005129]/10 bg-white p-6 shadow-2xl">
                  <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 animate-pulse rounded-full bg-[#006d36]" />
                      <span className="text-2xl font-semibold text-[#002111]">4 people ready nearby</span>
                    </div>
                    <span className="text-[#1a6b3c]">i</span>
                  </div>

                  <div className="mb-8 flex flex-wrap gap-2">
                    {['Deep Talk', 'Casual', 'Tech'].map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-[#6dfe9c]/20 px-4 py-2 text-sm font-semibold tracking-[0.05em] text-[#007439]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 rounded-2xl border border-[#bfc9be]/20 bg-[#e9ffed] p-4">
                    <span className="text-[#005129]">●</span>
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.05em] text-[#005129]">Current Hotspot</p>
                      <p className="text-lg font-semibold text-[#002111]">The Roasted Bean Cafe</p>
                    </div>
                  </div>

                  <div className="absolute -left-6 -top-6 h-16 w-16 overflow-hidden rounded-full border-4 border-[#e9ffed] shadow-lg transition-transform hover:scale-110">
                    <img
                      alt="User Avatar"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuA5XQLN59RHNCm-WV2iw73uoYJZyEwyWx86SvrwA1651-KvJThiFlAVqMGjfaL2AmQRhPHsZ-z2X_QsVqQIRDcKo4b5lKfA0k_Q3-RfdynL6Iv0DJOJ1LNzDH6-XQ7DlY1phSQTuuFzqYjTD2auFtbCxas4KgCDUf_SUvXDCAJ61CZ76klptEEftEKfA95R9SZWIjf2f6Et18ucD0sgRngDgBwKHlJ0fncs2xnPxNspz0K4r62nznu4WO2hL2eEh-ShgK72uB4qFA"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="absolute -bottom-4 -right-4 h-14 w-14 overflow-hidden rounded-full border-4 border-[#e9ffed] shadow-lg transition-transform hover:scale-110">
                    <img
                      alt="User Avatar"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuCq9u1VoUIojRs6_q9E1J__wIV81y3pUsG4m8NXwmS5OqWlOwiVER6BuU8EPm4R2d2BH1fAx_12ScpUpGM0armH44A-9dlq02avy6WOusw7oJdKXKRRf_DDK4_Qiq3AJH12floSiVlDNwjYfxuwjUrv5vHUtmF-Mj6hqjNy5yz8M2uyf3TUh1erjg6TGgjClE8kcBIQ-3RwM60hOnrBWTm5HEbdW-zyncxUDlEA4Hxt1_VRSNNh4kjxfPHeLvFgSRwQjoInQDHFFw"
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section
            id="how-it-works"
            className="lt-reveal-on-scroll overflow-hidden bg-[#d5fde0]/30 px-5 py-16 md:px-10"
          >
            <div className="mx-auto max-w-7xl">
              <h2 className="mb-12 text-center text-4xl font-bold text-[#005129]">
                Three steps to a real conversation
              </h2>
              <div className="relative grid grid-cols-1 gap-12 md:grid-cols-3">
                <div className="group flex flex-col items-center text-center">
                  <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-[#005129]/5 bg-white text-3xl shadow-sm transition-transform group-hover:scale-110">
                    🎭
                  </div>
                  <h3 className="mb-2 text-2xl font-semibold text-[#002111]">Step 1</h3>
                  <p className="text-base font-light leading-6 text-[#404940]">
                    Set your mood &amp; intent so others know what you&apos;re up for.
                  </p>
                  <div className="lt-step-line absolute left-[25%] top-10 hidden h-[1px] md:block" />
                </div>

                <div className="group flex flex-col items-center text-center">
                  <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-[#005129]/5 bg-white text-3xl shadow-sm transition-transform group-hover:scale-110">
                    📍
                  </div>
                  <h3 className="mb-2 text-2xl font-semibold text-[#002111]">Step 2</h3>
                  <p className="text-base font-light leading-6 text-[#404940]">
                    Check into a place to let nearby users see you&apos;re available.
                  </p>
                  <div className="lt-step-line absolute right-[25%] top-10 hidden h-[1px] md:block" />
                </div>

                <div className="group flex flex-col items-center text-center">
                  <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-[#005129]/5 bg-white text-3xl shadow-sm transition-transform group-hover:scale-110">
                    💬
                  </div>
                  <h3 className="mb-2 text-2xl font-semibold text-[#002111]">Step 3</h3>
                  <p className="text-base font-light leading-6 text-[#404940]">
                    Connect &amp; talk with someone interesting right then and there.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="lt-reveal-on-scroll px-5 py-16 md:px-10">
            <div className="mx-auto max-w-7xl">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {features.map((feature) => (
                  <div
                    key={feature.title}
                    className="lt-card-lift rounded-[24px] border border-[#005129]/10 bg-white p-6"
                  >
                    <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-[#cff8da] text-[#005129]">
                      <span className="text-2xl">{feature.icon}</span>
                    </div>
                    <h3 className="mb-3 text-2xl font-semibold text-[#005129]">
                      {feature.title}
                    </h3>
                    <p className="text-base font-light leading-6 text-[#404940]">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="lt-reveal-on-scroll px-5 py-16 md:px-10">
            <div className="mx-auto max-w-7xl">
              <h2 className="mb-12 text-center text-4xl font-bold text-[#005129]">
                Real people, real conversations
              </h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {testimonials.map((testimonial) => (
                  <div
                    key={testimonial.name}
                    className="lt-card-lift rounded-[24px] border border-[#005129]/5 bg-[#f0faf0] p-6"
                  >
                    <div className="mb-4 flex items-center gap-4">
                      <div className="h-12 w-12 overflow-hidden rounded-full bg-[#a5f4b8]">
                        <img
                          alt={`${testimonial.name} Avatar`}
                          src={testimonial.image}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold uppercase tracking-[0.05em] text-[#005129]">
                          {testimonial.name}
                        </h4>
                        <p className="text-xs text-[#404940]">{testimonial.place}</p>
                      </div>
                    </div>
                    <p className="text-base font-light italic leading-6 text-[#404940]">
                      "{testimonial.quote}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="lt-reveal-on-scroll px-5 py-16 md:px-10">
            <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[48px] bg-gradient-to-br from-[#005129] to-[#1a6b3c] p-12 text-center text-white">
              <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute -bottom-10 -right-10 h-60 w-60 rounded-full bg-[#6dfe9c]/20 blur-3xl" />
              <div className="relative z-10 space-y-6">
                <h2 className="text-4xl font-extrabold md:text-[48px] md:leading-[56px]">
                  Ready to have a real conversation today?
                </h2>
                <p className="mx-auto max-w-2xl text-lg font-light leading-7 text-[#9ae9ae]">
                  Join people already discovering meaningful connections nearby. It&apos;s free, it&apos;s local, and it&apos;s happening now.
                </p>
                <div className="pt-4">
                  <button
                    type="button"
                    onClick={onSignup}
                    className="lt-shimmer-btn rounded-full bg-white px-12 py-5 text-lg font-semibold tracking-[0.05em] text-[#005129] shadow-xl transition-transform hover:scale-105"
                  >
                    <span className="relative z-10">Get Started Free</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-[#bfc9be]/10 bg-white">
          <div className="mx-auto max-w-7xl px-5 py-16 md:px-10">
            <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
              <div className="text-center md:text-left">
                <div className="mb-2 text-2xl font-bold text-[#005129]">LetsTalk</div>
                <p className="text-base font-light text-[#404940]">Real conversations, real places</p>
              </div>
              <div className="flex gap-6">
                <button type="button" className="text-sm font-semibold uppercase tracking-[0.05em] text-[#404940] transition-colors hover:text-[#005129]">
                  About
                </button>
                <button type="button" className="text-sm font-semibold uppercase tracking-[0.05em] text-[#404940] transition-colors hover:text-[#005129]">
                  Privacy
                </button>
                <button type="button" className="text-sm font-semibold uppercase tracking-[0.05em] text-[#404940] transition-colors hover:text-[#005129]">
                  Contact
                </button>
              </div>
            </div>

            <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-[#bfc9be]/5 pt-6 text-[#404940]/70 md:flex-row">
              <p className="text-sm font-semibold uppercase tracking-[0.05em]">
                © 2024 LetsTalk. All rights reserved.
              </p>
              <div className="flex gap-4">
                <span className="cursor-pointer transition-colors hover:text-[#005129]">○</span>
                <span className="cursor-pointer transition-colors hover:text-[#005129]">@</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

import { lazy, Suspense } from 'react'
import { Link, useNavigate } from 'react-router'

import { Button } from './ui/button'
import { Icon } from './ui/icon'

const Hero3DScene = lazy(() => import('./acheevy/hero-3d'))

const PublicHomePage = () => {
    const navigate = useNavigate()
    const handleLogin = () => {
        navigate('/login')
    }

    return (
        <div className="flex flex-col h-screen justify-between px-3 md:px-6 pt-4 md:pt-8 pb-12 overflow-auto">
            <Link to="/" className="flex items-center gap-x-3">
                <img
                    src="/images/logo-only.png"
                    className="size-10 hidden dark:inline"
                    alt="Logo"
                />
                <img
                    src="/images/logo-charcoal.svg"
                    className="size-10 inline dark:hidden"
                    alt="Logo"
                />
                <span className="text-2xl font-semibold acheevy-gradient-text">
                    ACHEEVY-009
                </span>
            </Link>
            <div className="flex-1 flex flex-col justify-center items-center mt-8 md:mt-0">
                <p className="text-2xl md:text-[32px] font-semibold acheevy-gradient-text">
                    Meet Agent ACHEEVY-009
                </p>

                <div className="relative w-full max-w-md h-64 md:h-80 mt-2">
                    <Suspense fallback={
                        <img
                            src="/images/agent-head.png"
                            alt="ACHEEVY-009 Agent"
                            className="w-50 md:w-80 mx-auto"
                        />
                    }>
                        <Hero3DScene className="w-full h-full rounded-2xl" />
                    </Suspense>
                </div>
                <p className="text-center mt-6 text-xl md:text-2xl text-firefly dark:text-white">
                    Your intelligent agent for creating, researching, and
                    shipping fast.
                </p>
                <p className="text-center mt-2 text-sm text-grey-2 font-mono tracking-wider">
                    Powered by the NtNtN Creative Build Engine
                </p>
                <Button
                    onClick={handleLogin}
                    className="mt-6 h-10 md:h-12 px-4 md:px-6 rounded-3xl acheevy-btn-primary"
                >
                    Start Your First Task
                </Button>
                <div className="mt-12 w-full max-w-5xl">
                    <div className="grid gap-3 md:gap-4 grid-cols-2">
                        {[
                            [
                                {
                                    icon: 'usb',
                                    title: 'Your Data, Your Control',
                                    description:
                                        'BYOK – connect your own API keys and services for private, high-performance runs.',
                                    highlights: [],
                                    ctaLabel: ''
                                },
                                {
                                    icon: 'presentation',
                                    title: 'From Idea to Deck in Minutes',
                                    description:
                                        'Generate slide outlines, refine every block, and export when ready - no context switching.'
                                },
                                {
                                    icon: 'bracket-square',
                                    title: 'Delegate the Code. Keep the Control.',
                                    description:
                                        'When implementation gets heavy, bring Codex Agent into the thread.',
                                    ctaLabel: ''
                                }
                            ],
                            [
                                {
                                    icon: 'property-search',
                                    title: 'Research That Cites Its Sources',
                                    description:
                                        'ACHEEVY plans, reads, and synthesizes across the web and your files - returning structured insights with citations.',
                                    highlights: [
                                        'Browsing',
                                        'Source graphs',
                                        'Evidence snippets',
                                        'One-tap briefs'
                                    ],
                                    ctaLabel: ''
                                },
                                {
                                    icon: 'ai-browser',
                                    title: 'Describe It. Ship It.',
                                    description:
                                        'Turn a prompt into a working site: scaffold pages, sections, and components; preview, edit, and export.',
                                    highlights: [
                                        'Live preview',
                                        'Clean markup',
                                        'Component library',
                                        'Export to repo/zip'
                                    ],
                                    ctaLabel: ''
                                }
                            ]
                        ].map((column, columnIndex) => (
                            <div
                                key={columnIndex}
                                className="flex flex-col gap-3 md:gap-4"
                            >
                                {column.map(
                                    (
                                        {
                                            icon,
                                            title,
                                            description,
                                            highlights,
                                            ctaLabel
                                        },
                                        featureIndex
                                    ) => (
                                        <div
                                            key={`${title}-${featureIndex}`}
                                            className="group relative overflow-hidden rounded-xl border border-acheevy-border bg-acheevy-surface px-3 py-5 md:px-4 shadow-acheevy dark:bg-charcoal-surface dark:text-grey hover:border-acheevy-purple/25 transition-all duration-300"
                                        >
                                            <div className="relative flex justify-center h-full flex-col gap-3 md:gap-6">
                                                <div className="flex justify-center">
                                                    <Icon
                                                        name={icon}
                                                        className="size-12 md:size-16 fill-acheevy-purple"
                                                    />
                                                </div>
                                                <div className="text-center">
                                                    <h3 className="text-base md:text-2xl font-semibold text-black dark:text-white">
                                                        {title}
                                                    </h3>
                                                    <p className="mt-[6px] text-xs md:text-base text-firefly dark:text-grey-2">
                                                        {description}
                                                    </p>
                                                </div>
                                                {highlights?.length ? (
                                                    <div className="flex flex-wrap justify-center gap-3">
                                                        {highlights.map(
                                                            (item) => (
                                                                <div
                                                                    key={item}
                                                                    className="inline-flex items-center gap-1 md:gap-2 rounded-full border border-acheevy-border px-3 md:px-4 py-1 md:py-1.5 text-[10px] md:text-sm font-semibold text-acheevy-purple dark:border-acheevy-purple/20 dark:text-acheevy-purple"
                                                                >
                                                                    <Icon
                                                                        name="arrow-right-2"
                                                                        className="size-3 fill-acheevy-purple dark:fill-acheevy-purple"
                                                                    />
                                                                    <span className="flex-1">
                                                                        {item}
                                                                    </span>
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                ) : null}
                                                {ctaLabel ? (
                                                    <Button
                                                        onClick={handleLogin}
                                                        className="mt-3 h-7 md:h-12 w-fit m-auto rounded-3xl acheevy-btn-primary"
                                                    >
                                                        {ctaLabel}
                                                    </Button>
                                                ) : null}
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="flex justify-center gap-x-10 mt-8 md:mt-12">
                <Link
                    to="/terms-of-use"
                    className="dark:text-white text-sm font-semibold"
                >
                    Terms of Use
                </Link>
                <Link
                    to="/privacy-policy"
                    target="_blank"
                    className="dark:text-white text-sm font-semibold"
                >
                    Privacy Policy
                </Link>
            </div>
        </div>
    )
}

export default PublicHomePage

import React from 'react'
import Link from 'next/link'

export default function TopBar({ children }) {
	return (
		<header className="topbar p-3">
			<div className="app-container flex items-center justify-between">
				<div className="flex items-center gap-3">
					<Link href="/" className="flex items-center gap-3 text-white font-semibold">
						<span className="icon-circle bg-gradient-to-r from-purple-600 to-pink-500"><i className="bi bi-film text-white" /></span>
						<span className="text-lg">Party Player</span>
					</Link>
				</div>

				<div className="flex items-center gap-3">
					<div className="hidden sm:block muted text-sm">Make watching together fun</div>
					{children}
				</div>
			</div>
		</header>
	)
}

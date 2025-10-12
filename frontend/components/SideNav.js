import React from 'react'
import Link from 'next/link'

export default function SideNav({ className }) {
	return (
		<aside className={`sidenav p-4 w-64 text-gray-100 ${className || ''}`}>
			<div className="space-y-4">
				<div className="px-2 py-2 text-sm text-gray-400">Navigation</div>
				<nav className="flex flex-col space-y-1">
					<Link href="/" className="flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-800">
						<i className="bi bi-house" />
						<span>Home</span>
					</Link>
					<Link href="/friends" className="flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-800">
						<i className="bi bi-people" />
						<span>Friends</span>
					</Link>
					<Link href="/profile" className="flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-800">
						<i className="bi bi-person" />
						<span>Profile</span>
					</Link>
				</nav>
			</div>
		</aside>
	)
}

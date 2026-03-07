// SECURITY FIX REQUIRED — ML: Potential command injection
// CWE: None
// Description: ML classifier detected potential command injection (confidence: 0.99).
// TODO: Apply a proper fix for this vulnerability.
import Link from 'next/link'
import Image from 'next/image'
import NavItems from "@/components/NavItems";
import UserDropdown from "@/components/UserDropdown";
const Header = async ({ user }: { user: User }) => {
    return (
        <header className="sticky top-0 header">
            <div className="container header-wrapper">
                <Link href="/">
                    <Image
                        src="/assets/icons/logo.svg"
                        alt="QuantPulse logo"
                        width={140}
                        height={32}
                        className="h-8 w-auto cursor-pointer"
                    />
                </Link>
                <nav className="hidden sm:block">
                    <NavItems />
                </nav>
                <UserDropdown user={user}  />
            </div>
        </header>
    )
}

export default Header

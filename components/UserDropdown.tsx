'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { signOut } from '@/lib/actions/auth.actions'

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { Button } from '@/components/ui/button'
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from '@/components/ui/avatar'

import NavItems from '@/components/NavItems'

type UserDropdownProps = {
    user: User
    initialStocks: StockWithWatchlistStatus[]
}

const UserDropdown = ({ user, initialStocks }: UserDropdownProps) => {
    const router = useRouter()

    const handleSignOut = async () => {
        await signOut()
        router.push('/sign-in')
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src="https://github.com/shadcn.png" />
                        <AvatarFallback>
                            {user.name?.[0] ?? 'U'}
                        </AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent>
                <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                </DropdownMenuItem>

                <DropdownMenuSeparator className="sm:hidden" />

                <nav className="sm:hidden">
                    <NavItems initialStocks={initialStocks} />
                </nav>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export default UserDropdown

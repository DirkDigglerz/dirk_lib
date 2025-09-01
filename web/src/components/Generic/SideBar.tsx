import { Box } from "@mantine/core"
import { motion, AnimatePresence } from "framer-motion"
import { useEffect } from "react"

type SideBarProps = {
  menuOpen: boolean
  setMenuOpen?: (open: boolean) => void
  escapeClose?: boolean
  children: React.ReactNode
  style?: React.CSSProperties
  onClose?: () => void
  w?: string
  h?: string
  pt?: string
  p?: string
}

// @ts-expect-error Mantine/Motion no likey
const MotionBox = motion(Box)

function SideBar(props: SideBarProps) {
  const { menuOpen, setMenuOpen, escapeClose, onClose } = props

  // Escape key handling
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "Escape" && menuOpen && escapeClose) {
        onClose?.()
        setMenuOpen?.(false)
      }
    }
    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [menuOpen, escapeClose, onClose, setMenuOpen])

  return (
    <AnimatePresence>
      {menuOpen && (
        <MotionBox
          p={props.p || "0"}
          pt={props.pt || "0"}
          pos="absolute"
          right={0}
          bg="linear-gradient(
            270deg,
            rgba(0, 0, 0, 0.85) 0%,
            rgba(0, 0, 0, 0.6) 60%,
            rgba(0, 0, 0, 0) 100%
          )"
          w={props.w}
          h={props.h}
          style={props.style}
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          {props.children}
        </MotionBox>
      )}
    </AnimatePresence>
  )
}

export default SideBar

import { IconProp } from "@fortawesome/fontawesome-svg-core"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { alpha, Box, Flex, Image, Text, useMantineTheme } from "@mantine/core"
import { motion } from "framer-motion"
import { useEffect, useMemo, useRef, useState } from "react"
import getImageType from "../../utils/getImagePath"
import { MotionFlex } from "../App"

export type NotificationProps = {
  title?: string
  titleColor?: string
  description?: string
  duration?: number
  showDuration?: boolean
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  icon?: string
  iconColor?: string
  iconBg?: string
  iconAnimation?: string

  // FOR UI 
  id: string
  hide?: boolean
  count?: number
  onRemove?: () => void
}

export default function Notification(props: NotificationProps) {
  const theme = useMantineTheme()
  const [amountEffect, setAmountEffect] = useState(false)
  const [timeLeft, setTimeLeft] = useState(100)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const imageType = useMemo(() => {
    return getImageType(props.icon)
  }, [props.icon])

  // Count pulse effect
  useEffect(() => {
    if (props.count && !amountEffect) {
      setAmountEffect(true)
      setTimeout(() => setAmountEffect(false), 100)
    }
  }, [props.count])

  // Countdown — starts on mount, calls onRemove when done
  useEffect(() => {
    setTimeLeft(100)
    const tick = (props.duration ?? 5000) / 100

    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!)
          intervalRef.current = null
          props.onRemove?.()
          return 0
        }
        return prev - 1
      })
    }, tick)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [props.duration])

  const fromTop = props.position.startsWith('top')

  return (
    <MotionFlex
      pos='relative'
      initial={{ opacity: 0, scale: 0.92, y: fromTop ? -12 : 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: fromTop ? -12 : 12, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      h='fit-content'
      direction='column'
      style={{
        background: alpha(theme.colors.dark[9], 0.55),
        borderRadius: theme.radius.sm,
        border: '0.1vh solid rgba(255,255,255,0.07)',
        boxShadow: '0 0.74vh 2.96vh rgba(0,0,0,0.5)',
        minWidth: '20vh',
        maxWidth: '35vh',
        overflow: 'hidden',
      }}
    >
      {/* ── Main content ── */}
      <Flex p='1.2vh 1.4vh' gap='1vh'>

        {props.count && (
          <Box
            style={{
              position: 'absolute',
              top: '0.6vh',
              right: '0.6vh',
              backgroundColor: alpha(theme.colors[theme.primaryColor][9], 0.2),
              border: '0.1vh solid rgba(255,255,255,0.07)',
              borderRadius: theme.radius.sm,
              padding: '0 0.5vh',
              textAlign: 'center',
              transform: amountEffect ? 'scale(1.2)' : 'scale(1)',
              transition: 'all 0.2s ease-in-out',
              zIndex: 1000,
            }}
          >
            <Text
              style={{
                fontFamily: 'Akrobat Bold, sans-serif',
                fontSize: '0.85vh',
                color: theme.colors[theme.primaryColor][6],
                textShadow: `0 0 0.2vh ${theme.colors[theme.primaryColor][7]}, 0 0 0.3vh ${theme.colors[theme.primaryColor][9]}66`,
              }}
            >
              {props.count}
            </Text>
          </Box>
        )}

        <NotificationImage imageType={imageType} {...props} />

        <Flex direction='column' flex={1} gap={2}>
          <Text
            style={{
              fontSize: '1.3vh',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: props.titleColor || 'white',
              textShadow: props.titleColor
                ? undefined
                : `0 0 0.2vh ${theme.colors[theme.primaryColor][7]}, 0 0 0.3vh ${theme.colors[theme.primaryColor][9]}66`,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {props.title?.toUpperCase()}
          </Text>

          {props.description && (
            <Text
              style={{
                fontSize: '1.2vh',
                color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.04em',
              }}
            >
              {props.description}
            </Text>
          )}
        </Flex>
      </Flex>

      {/* ── Duration bar — flush to bottom ── */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '0.35vh',
        background: 'rgba(255,255,255,0.06)',
        borderTop: '0.1vh solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        <motion.div
          style={{
            position: 'absolute',
            top: 0, left: 0,
            height: '100%',
            background: `linear-gradient(90deg, ${theme.colors[theme.primaryColor][9]}, ${theme.colors[theme.primaryColor][7]})`,
            boxShadow: `0 0 0.8vh ${theme.colors[theme.primaryColor][6]}88`,
          }}
          animate={{ width: `${timeLeft}%` }}
          transition={{ duration: 0.08, ease: 'linear' }}
        />
        <motion.div
          style={{
            position: 'absolute',
            top: 0,
            width: '35%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)',
            pointerEvents: 'none',
          }}
          animate={{ left: ['-35%', '120%'] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    </MotionFlex>
  )
}

function NotificationImage(props: NotificationProps & { imageType: false | { type: string, path: string } }) {
  const theme = useMantineTheme()
  return (
    <Box
      h='4vh'
      mah='4vh'
      bg={props.iconBg || alpha(theme.colors[theme.primaryColor][9], 0.25)}
      style={{
        borderRadius: theme.radius.xs,
        aspectRatio: '1/1',
        border: '0.1vh solid rgba(255,255,255,0.07)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <Flex justify='center' align='center' h='100%' w='100%'>
        {props.imageType && props.imageType.type === 'icon' && (
          <FontAwesomeIcon
            icon={props.icon as IconProp || 'fas fa-info-circle' as IconProp}
            color={props.iconColor || theme.colors[theme.primaryColor][9]}
            style={{ fontSize: '2vh' }}
          />
        )}
        {props.imageType && props.imageType.type === 'image' && (
          <Image
            src={props.imageType.path}
            alt='icon'
            h='3vh'
            style={{ aspectRatio: '1/1' }}
          />
        )}
      </Flex>
    </Box>
  )
}
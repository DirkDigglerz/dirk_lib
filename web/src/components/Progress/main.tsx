import { IconProp } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { alpha, Flex, Text, useMantineTheme } from "@mantine/core";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNuiEvent } from "../../hooks/useNuiEvent";
import { locale } from "../../stores/locales";
import { fetchNui } from "../../utils/fetchNui";
import { getPositionProps, getTranslate, PositionProps } from "../../utils/positioning";
import { MotionFlex } from "../App";

type ProgressProps = {
  position: PositionProps 
  icon?: string
  label: string
  description?: string
  duration: number
}

export default function ProgressBar() {
  const theme = useMantineTheme()
  const [display, setDisplay] = useState(false)
  const [pause, setPause] = useState(false)
  const [progress, setProgress] = useState(0)
  const [options, setOptions] = useState<ProgressProps>({
    position: 'bottom-center',
    icon: 'fa fa-bars',
    description: 'This is a progress bar',
    label: 'Digging a hole',
    duration: 60000
  })
  
  useEffect(() => {
    if (!display) return
  
    const interval = setInterval(() => {
      if (!pause) {
        setProgress((prev: number) => {
          if (prev >= 100) {
            clearInterval(interval)
            setDisplay(false)
            fetchNui('PROGRESS_COMPLETE')
            return 0
          }
          return prev + 1
        })
      }
    }, options.duration / 100)
  
    return () => clearInterval(interval)
  }, [display, options.duration, pause])
  
  useNuiEvent('SHOW_PROGRESS', (data: ProgressProps) => {
    setPause(false)
    setOptions(data)
    setProgress(0)
    setDisplay(true)
  })
  
  useNuiEvent('CANCEL_PROGRESS', () => {
    setPause(true)
    setOptions((prev: ProgressProps) => ({ ...prev, label: locale('progress_cancelled') }))
    setTimeout(() => {
      setDisplay(false)
      fetchNui('PROGRESS_COMPLETE')
      setProgress(0)
      setPause(false)
    }, 500)
  })


  return (
    <AnimatePresence>
      {display && (
        <MotionFlex
          initial={{ opacity: 0, y: 6, transform: getTranslate(options.position) }}
          animate={{ opacity: 1, y: 0, transform: getTranslate(options.position) }}
          exit={{ opacity: 0, y: 6, transform: getTranslate(options.position) }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          pos='absolute'
          {...getPositionProps(options.position)}
          direction='column'
          gap='xs'
          style={{
            width: '35vh',
            padding: '1.2vh 1.4vh',
            background: alpha(theme.colors.dark[9], 0.55),
            borderRadius: theme.radius.sm,
            border: '0.1vh solid rgba(255,255,255,0.07)',
            boxShadow: '0 0.74vh 2.96vh rgba(0,0,0,0.5)',
          }}
        >
          {/* ── Label row ── */}
          <Flex align='center' justify='space-between' gap='xs'>
            <Flex align='center' gap='xs' style={{ minWidth: 0 }}>
              {options.icon && (
                <FontAwesomeIcon
                  icon={options.icon as IconProp}
                  style={{
                    fontSize: '1.2vh',
                    color: 'rgba(255, 255, 255, 0.57)',
                    flexShrink: 0,
                  }}
                />
              )}
              <Text
                style={{
                  fontFamily: 'Akrobat Bold, sans-serif',
                  fontSize: '1.25vh',
                  fontWeight: 700,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.55)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {options.label}
              </Text>
            </Flex>
            <Text
              style={{
                fontFamily: 'Akrobat Bold',
                fontSize: '1.2vh',
                // fontWeight: 600,
                letterSpacing: '0.08em',
                flexShrink: 0,
                color: theme.colors[theme.primaryColor][6],
                textShadow: `
                  0 0 0.2vh ${theme.colors[theme.primaryColor][7]},
                  0 0 0.3vh ${theme.colors[theme.primaryColor][9]}66
                `,
              }}
            >
              {progress}%
            </Text>
          </Flex>

          {/* ── Slim track ── */}
          <div style={{ position: 'relative', width: '100%', height: '0.8vh', borderRadius: theme.radius.sm, background: 'rgba(255,255,255,0.06)', border: '0.1vh solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <motion.div
              style={{
                position: 'absolute',
                top: 0, left: 0,
                height: '100%',
                borderRadius: theme.radius.sm,
                background: `linear-gradient(90deg, ${theme.colors[theme.primaryColor][9]}, ${theme.colors[theme.primaryColor][7]})`,
                boxShadow: `0 0 0.8vh ${theme.colors[theme.primaryColor][6]}88`,
              }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.08, ease: 'linear' }}
            />
            {/* shimmer */}
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


          {/* ── Optional description ── */}
          {options.description && (
            <Text
              style={{
                fontFamily: 'Akrobat Bold, sans-serif',
                fontSize: '1.1vh',
                color: 'rgba(255,255,255,0.3)',
                letterSpacing: '0.04em',
                marginTop: '-0.2vh',
              }}
            >
              {options.description}
            </Text>
          )}
        </MotionFlex>
      )}
    </AnimatePresence>
  )
}
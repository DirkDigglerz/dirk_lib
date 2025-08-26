import { IconProp } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Flex, Text, Transition, useMantineTheme } from "@mantine/core";
import { useEffect, useState } from "react";
import { useNuiEvent } from "../../hooks/useNuiEvent";
import { locale } from "../../stores/locales";
import colorWithAlpha from "../../utils/colorWithAlpha";
import { fetchNui } from "../../utils/fetchNui";
import { getPositionProps, getTranslate, PositionProps } from "../../utils/positioning";

type ProgressProps = {
  position: PositionProps 
  icon?: string
  label: string
  description?: string
  duration: number
}

export default function Progress() {
  const theme = useMantineTheme()
  const [display, setDisplay] = useState(false)
  const [pause, setPause] = useState(false)
  const [progress, setProgress] = useState(0)
  const [options, setOptions] = useState<ProgressProps>({
    position: 'bottom-center',
    icon: 'fa fa-bars',
    description: 'This is a progress bar',
    label: 'Progress',
    duration: 8000
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
    setProgress(0) // Reset progress to start from 0 when new progress starts
    setDisplay(true)
  })
  
  useNuiEvent('CANCEL_PROGRESS', () => {
    setPause(true)
    setOptions((prev : ProgressProps) => ({ ...prev, label: locale('progress_cancelled') }))
    setTimeout(() => {
      setDisplay(false)  // Turn off the display
      fetchNui('PROGRESS_COMPLETE')
      setProgress(0)     // Reset progress
      setPause(false)    // Reset pause state
      // Optionally clear all options here if needed
    }, 500)
  })
      //   bg='rgba(0,0,0,0.6)'
      // // mah='12vh'
      // // align='center'
      // h='fit-content'
      // p='1vh 2vh'
      // style={{
      //   // overflow: 'hidden',
      //   borderRadius: theme.radius.xxl,
      //   outline: `0.15vh solid ${colorWithAlpha(theme.colors[theme.primaryColor][9], 0.6)}`,
        
      //   transition: 'all 0.2s ease-in-out',
      // }}

      // align={'center'}
      // gap='sm'
  return (
    <Transition
      mounted={display}
      transition="fade"
      duration={400}
      timingFunction="ease"
     
    >
      {(styles) => (
        <Flex
          m='xs'
          p='2vh 2vh'
          pos='absolute'
          {...getPositionProps(options.position)}
          // bg={`linear-gradient(0deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.302621947216386) 16%, rgba(0,0,0,0.3) 46%, rgba(0,0,0,0.6) 100%)`}
          bg={'rgba(0,0,0,0.6)'}
          style={{
            borderRadius: theme.radius.xl,
            outline: `0.15vh solid ${colorWithAlpha(theme.colors[theme.primaryColor][9], 0.6)}`,
            transform: getTranslate(options.position),
            ...styles
          }}
          direction={'column'}
        >
          <Flex
            direction='column'
          >
            <Flex
              gap='xs'
              align='center'
            >
              {options.icon && (
                <FontAwesomeIcon
                  color='rgba(255,255,255,0.8)'
                  icon={options.icon as IconProp} 
                  style={{
                    fontSize: theme.fontSizes.xs, 
                  }}
                />  
              )}
              <Text
                size='xs'
                style={{
                  fontFamily: 'Akrobat Bold',
                  textShadow: `0 0 0.1vh ${colorWithAlpha(theme.colors[theme.primaryColor][theme.primaryShade as number], 0.9)}`
                }}
              >{options.label}</Text>
            </Flex>
            {options.description && (
              <Text
                size='xxs'
                c='rgba(255,255,255,0.8)'
              >
                {options.description}
              </Text>
            )}

          </Flex>

          <CustomProgress
            value={progress}
          />
        </Flex>
      
      )}
    </Transition>
  )
}

type CustomProgressProps = {
  value: number // Progress value in percentage
}

function CustomProgress({ value }: CustomProgressProps) {
  const theme = useMantineTheme()

  // Number of boxes in the progress bar
  const boxCount = 8
  const filledBoxes = Math.floor((value / 100) * boxCount) // Fully filled boxes
  const partialFill = ((value / 100) * boxCount) - filledBoxes // The remaining fraction of the current box

  return (
    <Flex
      w='28vh'
      gap='xxs'

      mt='xs'
      // bg='rgba(0, 0, 0, 0.4)'


      style={{
        borderRadius: theme.radius.sm,
        // overflow: 'hidden',
        
      }}
    >
      {Array.from({ length: boxCount }).map((_, index) => {
        // Determine if the current box should be fully filled, partially filled, or empty
        let fillPercentage = 0
        if (index < filledBoxes) {
          fillPercentage = 100 // Fully filled box
        } else if (index === filledBoxes) {
          fillPercentage = partialFill * 100 // Partially filled box
        }

        return (
          <Flex
            key={index}
            w={`${100 / boxCount}%`} // Divide width equally among boxes
            h='2vh'
            style={{
              position: 'relative',
              backgroundColor: 'rgba(0, 0, 0, 0.2)', // Default empty box color
              
              transition: 'background-color 0.3s ease', // Smooth transition for filling
              borderRadius: theme.radius.xxs,
              transform: 'skewX(-5deg)', // Skew the fill box to give a 3D effect
            }}
          >
            {/* Inner fill box that represents the progress */}
            <div
              style={{
                width: `${fillPercentage}%`,
                height: '100%',
                // backgroundColor: theme.colors[theme.primaryColor][theme.primaryShade as number],
                borderRadius: theme.radius.xs,
                backgroundColor: colorWithAlpha(theme.colors[theme.primaryColor][theme.primaryShade as number], 0.8),
                // boxShadow: fillPercentage > 0 
                //   ? `inset 0 0 2.5vh ${colorWithAlpha(theme.colors[theme.primaryColor][theme.primaryShade as number], 0.9)}`
                //   : 'none',
                // transform: 'skewX(-20deg)', // Skew the fill box to give a 3D effect
                // transition: 'width 0.1s ease', // Smooth transition for the width change
              }}
            />
          </Flex>
        )
      })}
    </Flex>
  )
}

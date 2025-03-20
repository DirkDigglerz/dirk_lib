import { IconProp } from "@fortawesome/fontawesome-svg-core"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Box, Flex, Image, Text, useMantineTheme } from "@mantine/core"
import { useEffect, useMemo, useState } from "react"
import colorWithAlpha from "../../utils/colorWithAlpha"
import getImageType from "../../utils/getImagePath"

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
  hide?: boolean
  count?: number
}



export default function Notification(props: NotificationProps){
  const theme = useMantineTheme();
  const [display, setDisplay] = useState(false)
  const [amountEffect, setAmountEffect] = useState(false) // For the amount effect


  const imageType = useMemo(() => {
    return getImageType(props.icon);
  } , [props.icon]);

  useEffect(() => {
    if (props.count && !amountEffect) {
      setAmountEffect(true)
      setTimeout(() => {
        setAmountEffect(false)
      }, 100)
    }
  }, [props.count])

  useEffect(() => {
    if (!props.hide) { 
      setTimeout(() => {
        setDisplay(true)
      }, 100)
    } else {
      setDisplay(false)
    }
  }, [props.hide])
  return (
    <Flex
      pos='relative' 
      right = {props.position.includes('right') ? !display ? '-150%' : '0': 'auto'}
      left = {props.position.includes('left') ? !display ? '-150%' : '0': 'auto'}
      top = {props.position.includes('top') ? !display ? '-150%' : '0': 'auto'}
      bottom = {props.position.includes('bottom') ? !display ? '-150%' : '0': 'auto'}
      bg='rgba(0,0,0,0.6)'
      // mah='12vh'
      // align='center'
      h='fit-content'
      p='xs'
      style={{
        // overflow: 'hidden',
        borderRadius: theme.radius.xxs,
        
        transition: 'all 0.2s ease-in-out',
      }}

      align={'center'}
      gap='xs'
      
    >
      {/* Box for the number */}
      {props.count && (
        <Box
          style={{
            position: 'absolute',
            top: '0.7vh',
            right: '0.7vh',
            backgroundColor: colorWithAlpha(theme.colors[theme.primaryColor][9], 0.2),
            outline: `0.2vh solid ${colorWithAlpha(theme.colors[theme.primaryColor][9], 0.6)}`,
            color: 'rgba(255,255,255,0.8)',
            borderRadius: theme.radius.xxs,
            padding: '0 0.6vh',  
            fontWeight: 700,
            aspectRatio: '1/1',
            textAlign: 'center',
            transform: amountEffect ? 'scale(1.2)' : 'scale(1)',
            transition: 'all 0.2s ease-in-out',
            zIndex: 1000, // Ensure it is above other content
          }}
        >
          <Text size='xxs'>{props.count}</Text>
        </Box> 
      )}

        <NotificationImage 
          imageType={imageType}
          {...props}
        />

        <Flex
          direction='column'
          // bg='red'
          flex={1}
        >
          <Text
            size='xs'
            c={props.titleColor || theme.colors[theme.primaryColor][9]}
            style={{
              fontFamily: 'Akrobat Bold',
              textShadow: `0 0 0.2vh ${props.titleColor || colorWithAlpha(theme.colors[theme.primaryColor][9], 1)}`
            }}
          >
            {props.title?.toUpperCase()}
          </Text>

          <Text
            c='rgba(255,255,255,0.6)'
            size='xxs'
          >
            {props.description}
          </Text>
        </Flex>

    </Flex>
  )
}

function NotificationImage (props: NotificationProps & {imageType: false | {type: string, path: string}}) {
  const theme = useMantineTheme();
  return (
    <Box
      // // direction={'column'}
      // justify={'center'}
      // align='center'
      h='4vh'
      // ml='xs'
      mah='4vh'
      bg={props.iconBg || props.iconColor && 'rgba(44,44,44,0.3)' || colorWithAlpha(theme.colors[theme.primaryColor][9], 0.2)}
      style={{
        borderRadius: '0.05vh',
        aspectRatio: '1/1',
        outline: `0.2vh solid ${props.iconColor  || colorWithAlpha(theme.colors[theme.primaryColor][9], 0.6)}`,
      }}
    >
      <Flex
        justify='center'
        align='center'
        h='100%'
        w='100%'
      >
        {props.imageType && props.imageType.type == 'icon' && (
          <FontAwesomeIcon  
            icon={props.icon as IconProp || 'fas fa-info-circle' as IconProp}
            color={props.iconColor || colorWithAlpha(theme.colors[theme.primaryColor][9], 0.8)}
            style={{
              fontSize: '2.4vh',
            }}
          /> 
        )}

        {props.imageType && props.imageType.type == 'image' && (
          <Image 
            src={props.imageType.path}
            alt='icon'
            h='3vh'
            style={{
              aspectRatio: '1/1',
            }}
          />
        )}

      </Flex>
    </Box>
  )
}


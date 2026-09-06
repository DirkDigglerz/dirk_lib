import { IconProp } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Flex, Text, Transition, useMantineTheme } from "@mantine/core";
import { useEffect, useState } from "react";
import { useNuiEvent } from "../../hooks/useNuiEvent";

import colorWithAlpha from "../../utils/colorWithAlpha";
import { fetchNui } from "../../utils/fetchNui";
import { locale } from "../../stores/locales";
import { setUiTheme } from '../../stores/uiTheme';

type Status = {
  id: string; 
  title: string;
  icon?: string;
  description: string;
  time?: number;
  progress?: number;
  progText?: string; 
}

export default function StatusInfo(){
  const [displayAll, setDisplayAll] = useState(true);
  const [ statuses, setStatuses ] = useState<Status[]>([
    // {
    //   id: '1',
    //   title: 'Sanitation Job',
    //   description: 'Please collect all the trash from the streets marked on your map before the time runs out.',     
    //   icon: 'dumpster',
    //   progress: 50,
    //   time: 5,
    // },

  ]);


  useNuiEvent('ADD_STATUS', (status: Status) => {
    // Whose colours this belongs to. `App` wraps this component in <Themed>,
    // so the whole thing — body and hooks included — renders in the calling
    // resource's palette.
    setUiTheme('status', (status as unknown as { theme?: never })?.theme);
    // remove status with the same id
    setStatuses((prev) => prev.filter((s) => s.id !== status.id));
    setStatuses((prev) => [...prev, status]);
  });

  useNuiEvent('REMOVE_STATUS', (id: string) => {
    setStatuses((prev) => prev.filter((status) => status.id !== id));
  });

  useNuiEvent('UPDATE_STATUS', (status: Status) => {
    setStatuses((prev) => prev.map((s) => s.id === status.id ? status : s));
  }); 

  useNuiEvent('HIDE_ALL_STATUS', (hidden: boolean) => {
    setDisplayAll(!hidden);
  });



  return (

    <Flex 
      direction='column-reverse' 
      pos='absolute' 
      left={displayAll ? '2%' : '-20%'}
      top='50%' 
      gap='1vh' 
    
      h='fit-content'
      mah='80vh'
      style={{
        overflowX: 'visible',
        overflowY:'hidden',
        userSelect: 'none',
        transition: 'all ease-in-out 0.5s',
        transform: 'translate(2%, -50%)',
      }}
    >
      {statuses.map((status) => (
        <Status key={status.id} {...status} display={displayAll} />
      ))}
    </Flex>
  );
}

function Status(props: Status & { display: boolean }){
  const theme = useMantineTheme();
  const [timeLeft, setTimeLeft] = useState(props.time || 0);
  const [timeString, setTimeString] = useState(props.time ? `${props.time > 60 ? `${Math.floor(props.time / 60)}m` : ''} ${props.time % 60}s`: '');

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = prev - 1;

        // Update time string inside the same callback
        setTimeString(() => {
          if (newTime <= 0) return locale('status_time_over');
          return `${newTime > 60 ? `${Math.floor(newTime / 60)}m` : ''} ${newTime % 60}s`;
        });

        // Stop the timer if time reaches zero
        if (newTime <= 0) {
          clearInterval(interval);
          fetchNui('STATUS_TIMER_OVER', {
            id: props.id,
          })
          // Call Lua or perform additional dirkup
        }

        return Math.max(newTime, 0); // Ensure time doesn't go negative
      });
    }, 1000);

    return () => clearInterval(interval); // Dirkup on unmount
  }, [props.time, props.id]);

  return (
    <Transition
      mounted={props.display}
      transition='slide-right'
      duration={500}
      timingFunction='ease'


    >
      {(transition) => (
        <Flex 
          gap='0.5vh' 
          align='center' 
          bg='rgba(0, 0, 0, 0.5)'
          w='20vh'
          p='1vh'
     
          direction={'column'}
          style={{
            borderRadius: theme.radius.xxs,
            boxShadow: '0 0 1vh rgba(0,0,0,0.5)',
            ...transition,
          }}
        >
          <Flex
          justify={'center'}
            align={'center'}
            w='90%'
            gap='0.4vh'
            pb='0.5vh'
            style={{
              borderBottom: `0.2vh solid ${colorWithAlpha(theme.colors[theme.primaryColor][theme.primaryShade as number], 0.9)}`,
            }}
          >
            {props.icon && (
              <FontAwesomeIcon
                icon={props.icon as IconProp}
                style={{
                  fontSize: '1.6vh',
                  aspectRatio: 1,
                }}
                color='rgba(255,255,255,0.6)'
              />
            )}
            <Text
              size='1.6vh'
              c='rgba(255,255,255,0.9)'
            >{props.title}</Text>
          </Flex>
    
          <Text
            size='1.5vh'
            c='rgba(255,255,255,0.8)'
            >{props.description}</Text>
    
          {props.progress && (
            <ProgressBar
              progress={props.progress}
              icon='tasks'
              text={props.progText || `${props.progress}%`}
            />    
          )}
          {props.time && (
            <ProgressBar
              progress={timeLeft ? (timeLeft / props.time) * 100 : 0}
              icon='clock'
              text={timeString}
            />
          )}
    
      
          
        </Flex>  
      )}

    </Transition>
  )
}


type ProgressBarProps = {
  progress: number;
  icon: string;
  text: string | number;
}

function ProgressBar(props: ProgressBarProps){
  const theme = useMantineTheme();
  return (
    <Flex
    w='100%'
    direction='column'
    >
    <Flex
      // ml='auto'
      p='0.4vh'
      gap='xxs'
      align='center'
    >
      <FontAwesomeIcon 
        icon={props.icon as IconProp}
        style={{
          fontSize: '1.5vh',
        }}
        color='rgba(255,255,255,0.6)'
      />
      <Text
        size='1.5vh'
        c='rgba(255,255,255,0.8)'
      >{props.text}</Text>
    </Flex>
    <Flex 
      mt='0.5vh'
      w='100%' 
      h='0.8vh'
      bg='rgba(255,255,255,0.2)'
      style={{
        borderRadius: theme.radius.xxs,
        boxShadow: 'inset 0 0 0.5vh rgba(0,0,0,0.2)',
      }}
    >
      <Flex 
        w={`${props.progress}%`} 
        bg={colorWithAlpha(theme.colors[theme.primaryColor][theme.primaryShade as number], 0.8)}
        style={{
          borderRadius: theme.radius.xxs,
          transition: 'all ease-in-out 0.5s',
        }}
      />
    </Flex>
  </Flex>
  )   
}


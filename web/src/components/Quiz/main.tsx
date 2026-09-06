import { IconName } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, Flex, Text } from '@mantine/core'
import { useState } from 'react'
import { useNuiEvent } from '../../hooks/useNuiEvent'
import { fetchNui } from '../../utils/fetchNui'
import SideBar from '../Generic/SideBar'
import InfoBox from './InfoBox'
import Questions from './Questions'
import { QuizInfoProps } from './types'
import { setUiTheme } from '../../stores/uiTheme';

function QuizTitle(props: {title: string, icon: string}){
  return ( 
    <Flex
      w='80%'
      direction='row'
      gap='sm'
      p='sm'
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        borderBottom: '1px solid var(--mantine-primary-color-9)',
      }}
    > 
    <FontAwesomeIcon icon={['fas', props.icon as IconName]} style={{ color: 'white' }} size='lg' /> 
    <Text size='1.5rem' style={{ color: 'white' }}>{props.title}</Text>
  </Flex>
    
  )
}



function QuizInfo(props : {quizInfo: QuizInfoProps}){
  return (
    <Flex
      mt='md'
      bg='rgba(0,0,0,0.4)' 
      w='80%'
      h='25vh'
      style={{
        borderRadius:'var(--mantine-radius-sm)',
      }}
      p='sm'
      direction='column'
    >
      <Text
        size='sm'
        c='rgba(255,255,255,0.7)'
      >You must pass this theory test in order to sit your practical driving test, take your time as it can have some deceving questions. Afterwards you'll be free to cause havoc on the streets of Los Santos</Text>
      <Flex

        mt='auto'
        p='md'
        justify={'space-between'}
      >
        <InfoBox title='Time Left' icon='clock' time={props.quizInfo.time}/>
        <InfoBox title='Pass Mark' icon='check-circle' text={props.quizInfo.passMark}/>
        <InfoBox title='Questions' icon='question-circle' text={props.quizInfo.questions.length}/>

      </Flex>
    </Flex>
  )
}



function Quiz(){
  // eslint-disable-next-line
  const [result, setResult] = useState<'none' | 'pass' | 'fail'>('none')
  const [open, setOpen] = useState(false)
  // eslint-disable-next-line
  const [answers , setAnswers] = useState<any>({})

  // useEffect(() => {
  // }, [answers])

  const are_all_questions_answered = () => {
    for (const key in answers) {
      if (answers[key] == null) {
        return false
      }
    }
    return true
  }

  const [quizInfo, setQuizInfo] = useState({
    title : 'Driving Theory Test',
    icon: 'question-circle',
    time: 30,
    timeout: 0,
    passMark: 10,
    answerAll: true,
    questions: [
      {
        type: 'multiple',
        image: 'https://www.wikihow.com/images/thumb/e/e1/Pass-Your-Driving-Test-Step-4-Version-2.jpg/v4-460px-Pass-Your-Driving-Test-Step-4-Version-2.jpg.webp',
        question: 'What does this sign mean?',
        options: ['No parking', 'No stopping', 'No entry'],
        correct: 'No parking'
      },
      {
        type: 'single',
        question: 'What does this sign mean?',
        image: 'https://www.wikihow.com/images/thumb/e/e1/Pass-Your-Driving-Test-Step-4-Version-2.jpg/v4-460px-Pass-Your-Driving-Test-Step-4-Version-2.jpg.webp',
        extraInfo: 'This sign is used to indicate that you are not allowed to stop your vehicle at this location.',
        options: ['No parking', 'No stopping', 'No entry'],
        correct: 'No stopping'
      },
      {
        type: 'single',
        question: 'What does this sign mean?',
        options: ['No parking', 'No stopping', 'No entry'],
        correct: 'No entry'
      },
      {
        type: 'single',
        question: 'What does this sign mean?',
        options: ['No parking', 'No stopping', 'No entry'],
        correct: 'No entry'
      },
      {
        type: 'single',
        question: 'What does this sign mean?',
        options: ['No parking', 'No stopping', 'No entry'],
        correct: 'No entry'
      },
      {
        type: 'text',
        question: 'What does this sign mean?',
        correct: 'No entry'
      },
      {
        type: 'number',
        question: 'What does this sign mean?',
        correct: 5
      },
    ]
  })
  // eslint-disable-next-line
  useNuiEvent('QUIZ_STATE', (data: any) => {
    // Whose colours this belongs to. `App` wraps this component in <Themed>,
    // so the whole thing — body and hooks included — renders in the calling
    // resource's palette.
    setUiTheme('quiz', (data as unknown as { theme?: never })?.theme);
    if (data.action == 'OPEN') { 
      setOpen(true)
      setAnswers({})

      if (data.quizInfo) {
        setQuizInfo(data.quizInfo)
      } 
    } else if (data.action == 'CLOSE') {
      setOpen(false)
      setAnswers({})
    } else if (data.action == 'UPDATE') {
      if (data.quizInfo) {
        setQuizInfo(data.quizInfo)
      }
    }
  
  })

  return (
    <SideBar w='30vw' h='100vh' 
      menuOpen={false}
      setMenuOpen={setOpen}
      escapeClose={true}
      style={{
        userSelect: 'none',
        display:'flex', 
        flexDirection:'column', 
        alignItems:'center',
      }}
    >
      <QuizTitle title={quizInfo.title} icon={quizInfo.icon}/>
      <QuizInfo quizInfo={quizInfo}/>
      <Questions questions={quizInfo.questions} answers={answers} setAnswers={setAnswers}/>

      <Flex h='fit-content' mb='sm' mt='sm' bg='rgba(0,0,0,0.4)' w='80%'
        style={{
          borderRadius:'var(--mantine-radius-sm)',
        }}
        p='sm'
        gap='sm'
        align='center'
        direction='row'
        justify='space-around'
      >
        <Button 
          bg='red'
          style={{
            border: '1px solid red'
          }}
          color='red'
          flex={0.5} 
          variant='default'
          leftSection={
            <FontAwesomeIcon icon={['fas', 'trash-can']} style={{ color: 'red' }} size='lg' />
          }
          c='white'
          onClick={() => {
            setOpen(false)
          }}
        >CANCEL</Button>

        <Button 
          
          flex={0.5} 
          variant='outline'
          disabled= {!are_all_questions_answered()}
          
          leftSection={
            <FontAwesomeIcon icon={['fas', 'check']} style={{ color: 'green' }} size='lg' />
          }
          c='green'

          onClick= {() => {
            fetchNui('QUIZ:SUBMIT', {
              answers: answers
            }, (data: {
              result: 'none' | 'pass' | 'fail'
            }) => {
              setResult(data.result)
            })
          }}
        >SUBMIT</Button>


      </Flex>
  
    </SideBar>
  )
}

export default Quiz

// internalEvent([
//   {
//     action: 'QUIZ_STATE',
//     data: {
//       action: 'OPEN',
      


//     }
//   }
// ])
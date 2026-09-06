local quiz_open = false

local openQuizUI = function(id, data, theme)
  quiz_open = true
  SetNuiFocus(true, true)
  SendNuiMessage(json.encode({
    action = 'QUIZ_STATE',
    data   = {
      action = 'OPEN',
      quiz = data,
      theme = theme,
    }
  }))
end

local closeQuizUI = function()
  if not quiz_open then return end
  quiz_open = false
  SetNuiFocus(false, false)
  SendNuiMessage(json.encode({
    action = 'QUIZ_STATE',
    data   = {
      action = 'CLOSE',
    }
  }))
end

RegisterNuiCallback('submitQuiz', function(data,cb) 
  cb(score)
end)

lib.startQuiz = function(quiz_id)
  -- Read BEFORE the await. `GetInvokingResource` answers for the frame that
  -- crossed the export boundary, and a yield ends that frame — after the
  -- callback returns it is nil and every quiz would wear dirk_lib's colours.
  local theme = lib.uiTheme(GetInvokingResource() or GetCurrentResourceName())

  local can_start, quiz_info = lib.callback.await('dirk_lib:quiz:start', quiz_id)
  if can_start then
    openQuizUI(quiz_id, quiz_info, theme)
  end
  return can_start, quiz_info
end

lib.closeQuiz = function()
  closeQuizUI()
end

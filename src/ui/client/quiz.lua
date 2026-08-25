local quiz_open = false

local openQuizUI = function(id,data)
  quiz_open = true
  SetNuiFocus(true, true)
  SendNuiMessage(json.encode({
    action = 'QUIZ_STATE',
    data   = {
      action = 'OPEN',
      quiz = data
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
  local can_start, quiz_info = lib.callback.await('dirk_lib:quiz:start', quiz_id)
  if can_start then
    openQuizUI(quiz_id, quiz_info)
  end
  return can_start, quiz_info
end

lib.closeQuiz = function()
  closeQuizUI()
end

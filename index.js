const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const doteenv = require('dotenv')


doteenv.config()
const app = express();

// Connect to MongoDB
const mongoURI = process.env.MONGODB_URI 
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }).then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Error connecting to MongoDB:', err));

//schema
const taskSchema = new mongoose.Schema({
    title: String,
    description: String,
    deadline: Date,
    priority: String,
    completed: { type: Boolean, default: false },
    chatId: Number 
});
``
const Task = mongoose.model('Task', taskSchema);

const token = '7032285514:AAG_RpEKxc-9xrBX7MZWCFtCxqbi2Eo2eMU';
// const token = process.env.TOKEN;
const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
    startFunc(msg)
});

function startFunc(msg){
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Welcome to Task Manager Bot! Here are the available commands:", {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Add Task', callback_data: 'addTask' }],
                [{ text: 'List Tasks', callback_data: 'listTasks' }],
                [{ text: 'Delete Task', callback_data: 'deleteTask' }],
                [{ text: 'Edit Task', callback_data: 'editTask' }]
            ]
        }
    });
}

bot.on('callback_query', async (callbackQuery) => {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;

    switch (action) {
        case 'addTask':
            addTask(msg)
            break;
        case 'listTasks':
            listTasks(msg)
            break;
        case 'deleteTask':
            deleteTask(msg)
            break;
        case 'editTask':
            editTask(msg)
            break;
        case 'backToStart':
            // bot.deleteMessage()
          startFunc(msg)
            break;
    }
});


async function addTask(msg){
    const chatId = msg.chat.id;
    // const currentDate = new Date('2024-05-25 12:13');
    // const adtxt = "`"+`Title: [task title]\nDescription: task description\nDeadline: 25.05.2024 12:13\nPriority: [priority]`+ "`"
    bot.sendMessage(chatId, "Please provide task details in the following format: \n`Title: [task title]\nDescription: task description\nDeadline: 25.05.2024 12:13\nPriority: [priority]`",{
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Back', callback_data: 'backToStart' }]
            ]
        }, 
        parse_mode: 'Markdown', 
    });
    bot.once("message", async(msg)=>{

        const text = msg.text;
        const lines = text.split('\n');
        const titleLine = lines.find(line => line.startsWith('Title:'));
        const descriptionLine = lines.find(line => line.startsWith('Description:'));
        const deadlineLine = lines.find(line => line.startsWith('Deadline:'));
        const priorityLine = lines.find(line => line.startsWith('Priority:'));
        
        if (!titleLine || !descriptionLine || !deadlineLine || !priorityLine) {
            bot.sendMessage(chatId, "Please provide all task details in the correct format.");
            return;
        }
        const title = titleLine.split(': ')[1];
        const description = descriptionLine.split(': ')[1];
        const deadlineString = deadlineLine.split(': ')[1]; 
        const priority = priorityLine.split(': ')[1];
    
        const deadlineParts = deadlineString.split(' ');
        const dateParts = deadlineParts[0].split('.'); // Split the date
        const timeParts = deadlineParts[1] ? deadlineParts[1].split(':') : ['00', '00']; //(default: 00:00)
        const year = parseInt(dateParts[2]);
        const month = parseInt(dateParts[1]) - 1; 
        const day = parseInt(dateParts[0]);
        const hours = parseInt(timeParts[0]);
        const minutes = parseInt(timeParts[1]);
        const deadline = new Date(year, month, day, hours, minutes); 
        if (isNaN(deadline.getTime())) {
            bot.sendMessage(chatId, "Invalid deadline format. Please use a valid date format.");
            return;
        }
    
        // Add task to MongoDB
        const newTask = new Task({ title, description, deadline, priority, chatId });
        await newTask.save();
        bot.sendMessage(chatId, "Task added successfully!");
    
        // Calculate reminder times
        const reminderTimes = calculateReminderTimes(deadline);
    
        // Send reminders
        reminderTimes.forEach((reminder, index) => {
            scheduleReminder(chatId, `Reminder ${index + 1}: ${reminder.message}`, reminder.time);
        });
        //reminder
        function scheduleReminder(chatId, message, time) {
            const now = new Date();
            const delay =   time - now;
            if (delay > 0) {
                setTimeout(() => {
                    bot.sendMessage(chatId, message);
                }, delay);
            }
        }
        //times
        function calculateReminderTimes(deadline) {
            const oneDayBefore = new Date(deadline);
            oneDayBefore.setDate(oneDayBefore.getDate() - 1);
        
            const tenHoursBefore = new Date(deadline);
            tenHoursBefore.setHours(tenHoursBefore.getHours() - 10);
        
            const fiveHoursBefore = new Date(deadline);
            fiveHoursBefore.setHours(fiveHoursBefore.getHours() - 5);
        
            const oneHourBefore = new Date(deadline);
            oneHourBefore.setHours(oneHourBefore.getHours() - 1);
        
            const oneMinuteBefore = new Date(deadline);
            oneMinuteBefore.setMinutes(oneMinuteBefore.getMinutes() - 1);
            const twoMinuteBefore = new Date(deadline);
            twoMinuteBefore.setMinutes(twoMinuteBefore.getMinutes() - 2);
            const threSecMinuteBefore = new Date(deadline);
            threSecMinuteBefore.setSeconds(threSecMinuteBefore.getSeconds() - 30);
        
            const reminders = [
                { message: '1 day before the deadline', time: oneDayBefore },
                { message: '10 hours before the deadline', time: tenHoursBefore },
                { message: '5 hours before the deadline', time: fiveHoursBefore },
                { message: '1 hour before the deadline', time: oneHourBefore },
                { message: '1 minute before the deadline', time: oneMinuteBefore },
                { message: '2 minute before the deadline', time: twoMinuteBefore },
                { message: '30 second before the deadline', time: threSecMinuteBefore }
            ]
        
            return reminders;
        }
    })
}

// list all
async function listTasks(msg){
        const chatId = msg.chat.id;
        const tasks = await Task.find({ chatId });
    
          // Hozirgi sana
                const currentDate = new Date();
                // Taskning tugash vaqti
                const deadlineDate = new Date(tasks.deadline);
    
                // Task tugaganmi tek
                if (deadlineDate < currentDate) {
                    // Agar task hali bajarilmagan bo'lsa
                    if (!tasks.task.completed) {
                        // MongoDBda xolatni o'zgartiramiz
                        await Task.findByIdAndUpdate(tasks._id, { completed: true });
                    }
                }
        if (tasks.length === 0) {
            bot.sendMessage(chatId, "No tasks found.");
        } else {
            tasks.forEach(async(task, index) => {
            
                // Vazifa tugagani tek
                const completionStatus = task.completed ? 'Yes' : 'No';;
                bot.sendMessage(chatId, `Task ${index + 1}:\nTitle: ${task.title}\nDescription: ${task.description}\nDeadline: ${task.deadline}\nPriority: ${task.priority}\nCompleted: ${completionStatus}`);
            });
        }
    };
    
    // delete
   function deleteTask(msg){
       const chatId = msg.chat.id;
       bot.sendMessage(chatId, "Please enter the number of the task you want to delete:");
       // // Handle delete task
       bot.once('message', async (msg) => {
           const chatId = msg.chat.id;
           const taskIndex = parseInt(msg.text) - 1;
           // Find task by index and delete from MongoDB
           const tasks = await Task.find({ chatId });
           if (taskIndex >= 0 && tasks.length > taskIndex) {
               await Task.findByIdAndDelete(tasks[taskIndex]._id);
               bot.sendMessage(chatId, "Task deleted successfully!");
               startFunc(msg)
           } else {
               bot.sendMessage(chatId, "Task not found.");
           }
       });

   }

const state = {};
// edit
async function editTask(msg) {
    const chatId = msg.chat.id;
    if (state[chatId]) {
        await bot.sendMessage(chatId, "You are already editing a task. Please finish the current edit process before starting a new one.");
        return;
    }
    // Ask 
    await bot.sendMessage(chatId, "Please enter the number of the task you want to edit:");
    // Set edittask
    state[chatId] = 'edittask';
}

// edit task
bot.on("message", async(msg)=> {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (state[chatId] === 'edittask') {
        const taskIndex = parseInt(text) - 1;
        // Find task by index
        const tasks = await Task.find({ chatId });
        if (tasks.length > taskIndex && taskIndex >= 0) { 
            const taskToEdit = tasks[taskIndex];
            const txt = "`"+ `Title:  ${taskToEdit.title}\nDescription: ${taskToEdit.description }\nDeadline: ${taskToEdit.deadline}\nPriority: ${taskToEdit.priority}` + "`"
            await bot.sendMessage(chatId, `Editing task: ${taskToEdit.title}\nPlease provide new task details in the following format:\n` + txt,{parse_mode: 'Markdown'} );
            state[chatId] = { action: 'editing', taskIndex, taskId: taskToEdit._id };
        } else {
            await bot.sendMessage(chatId, "Invalid task number. Please enter a valid task number.");
        }
    } else if (state[chatId] && state[chatId].action === 'editing') {
        // Parse task details
        const lines = text.split('\n');
        const title = lines.find(line => line.startsWith('Title:')).split(': ')[1];
        const description = lines.find(line => line.startsWith('Description:')).split(': ')[1];
        const deadline = lines.find(line => line.startsWith('Deadline:')).split(': ')[1];
        const priority = lines.find(line => line.startsWith('Priority:')).split(': ')[1];
        const taskId = state[chatId].taskId;
        // Update task in MongoDB
        await Task.findByIdAndUpdate(taskId, { title, description, deadline, priority });
        await bot.sendMessage(chatId, "Task updated successfully!");
        // Clear the state
        delete state[chatId];
    }
});





// Start Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

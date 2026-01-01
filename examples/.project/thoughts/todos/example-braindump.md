# Random thoughts about what needs to get done

Just brain dumping here, will process this later...

## Authentication stuff

- [ ] Need to implement OAuth flow - this is urgent because users can't log in without it
- [ ] Should add rate limiting to prevent abuse
- The session handling feels hacky, might want to refactor that eventually

## API improvements

I keep thinking we need better error handling. Right now when something fails the user just gets a generic error. Would be nice to:

- Show specific error messages
- Add error codes for the frontend to handle
- Log errors properly for debugging

Also need to add pagination to the list endpoints because performance is getting bad with lots of data.

## Technical debt

That hack we added for the date parsing is going to bite us. Need to fix it properly using a real date library.

Something is causing memory leaks in production - critical to investigate this week.

## Nice to have

- Dark mode would be cool
- Maybe add export to CSV functionality
- Users have been asking for keyboard shortcuts


let s:current_dir = expand("<sfile>:p:h")
let s:enabled = 1

function! EasyJS_Disable()
	let s:enabled = 0
endfunction

function! EasyJS_Enable()
	let s:enabled = 1
endfunction

function! EasyJS_Rewrite()
	if !s:enabled
		return
	endif

	let l:i = 1
	let l:end = line('$')
	let l:buftext = ''

	" Get the buffer contents, ensuring double quotes are properly escaped for
	" the system() call later
	while i <= end
		" let l:buftext .= substitute(getline(i), "'", "\\'", 'g') . '\n'
		let l:buftext .= getline(i) . '\n'
		let l:i += 1
	endwhile

	" Call our javascript rewriter and set the buffer to the result
	" This is where all the real work happens
	try
		let l:command = shellescape(s:current_dir . '/../parse.js') . ' $' . shellescape(l:buftext)
		let l:result = system(l:command)
		if v:shell_error != 0
			throw l:result
		endif

	catch
		if exists('l:result')
			echo "EasyJS_Rewrite Error: " . l:result
			unlet l:result
		endif

	finally
		if exists('l:result')
			let l:result_lines = split(l:result, '\r\?\n', 1)
			call setline(1, l:result_lines)

			" Delete trailing lines
			let l:delline = len(l:result_lines) + 1
			if l:delline <= l:end
				execute ':' . l:delline . ',' . l:end . 'd'
			endif
		endif
	endtry
endfunction

augroup EasyJS
	autocmd!

	" CursorHoldI event will fire after user stopped entering input
	" autocmd CursorHoldI *.js call EasyJS_Rewrite()

	" autocmd CursorHoldI,InsertLeave *.js call EasyJS_Rewrite()
augroup END

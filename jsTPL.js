/**
* Note that there're some core changes:
* All variables that you want to use in template must be defined in second argument of $.template or in className of element(if using $.render)
* If you pass variable, that's not defined before - it will be available only as $args.varName
* This is because of speed of execution of "with" method (no compiler optimizations)
* Now to use $p you must pass two arguments str and $_.
* Last one is input stack, normally you must pust $_
*/
var jsTPL = (function($,undefined) {
	/** Escaping closure
	 * Only global variables will be available here
	 * @return {Function}
	 */
	function $eval(a) {
		return eval(a)[0];
	}
 
    (function ($tab , gid ,
	                cache , namecache , $brackets , $modificator ,
					$tabs , $spaces , $decorator , modificators, rtrim) {				
					
				function map(arr, call) {
					if (arr.map)
						return arr.map(call);
						
					for (var i=0 , len = arr.length ; i<len ; i++)
						arr[i] = call(arr[i] , i);
					
					return arr;
				}
				// Built-in functions				
				
				// Modificators
				modificators = {
				
					// Direct output
					// Can handle jQuery object!
					// Example: {%= "hello world" %}
					/** @return {string} */
					"="	:	preg_decorate("$p(%1,$_);"),					
					
					// Short-hand for functions
					// Example: {%@ log() {console && console.log.apply(this,arguments);} %}
					/** @return {string} */
					"@"	:	preg_decorate("function %1"),
					
					// Short-hand for scopes
					// Example: {%~ alert(1) %}
					/** @return {string} */
					"~"	:	preg_decorate("(function(){%1})();"),
					
					// Short-hand for templates
					// Example: {%:templatename {arg1:val1,arg2:val2} %}
					/** @return {string} */
					":" : function (str , name) {
					
						name = str.match($modificator);
						
						return "$p(jsTPL('" + name[1] + "')(" + str.substr(name[0].length) + "),$_);";
					},
					
					// "if", "else", "elseif"
					// Example: {%if true%}I'm right!{%else%}I'm wrong{%/if%}
					// {%if false%}I'm wrong{%elseif true%}I'm true!{%/if%}
					/** @ret\urn {string} */
					"if": preg_decorate("if(%1){"),
					/** @return {string} */
					"else": return_decorate("}else{"),
					/** @return {string} */
					"elseif": preg_decorate("}else if(%1){"),
					/** @return {string} */
					
					"/if": return_decorate("}"),	
					
					// Short-hand for each method
					// Example: {%each arr%}<div>{%=this%}</div>{%/each%}
					/** @return {string} */
					"each": preg_decorate("jsTPL.each(%1,function($i){"),
					/** @return {string} */
					"/each": return_decorate("});"),
					
					// Catch
					// Example: {%catch var a%}<div></div>{%/catch%}{%= a%}
					/** @return {string} */
					"catch" : preg_decorate("%1=(function(){var $_=[];"),
					/** @return {string} */
					"/catch" : return_decorate("return $_.join('')})();")
				};
				
		/**
		*	Generate function replacing pattern %1 in string
		*	@param {string} str string with pattern
		*	@return {function(string): string}
		*/
		function preg_decorate(str) {		
			/**
			* @param {string} s string to insert into str
			* @return {string}
			*/
			return function (s) {
				return str.replace($decorator , s , str);
			};
		}
		
		/**
		*	Generate function simply returning obj
		*	@param {string} obj object to return
		*	@return {function(): string}
		*/
		function return_decorate(obj) {
			/**
			* @return {string}
			*/
			return function() {
				return obj;
			}
		}
		
		/**
		* Generate, cache, return template
		* $.template("name") - get cached template with name
		* $.template("%template%", {args}, [name]) - generate template and optionally give it a name
		* Args = Template arguments
		* @param {string} str Input template, or template name
		* @return {function(object): object}
		*/
		$ = function (str , args, name) {
			// If have been cached by name
			// $.template("name")
			if ((arguments.length == 1) && (i = namecache[str]))
				return i;
			
			// If have been cached template
			// $.template("%template%" , [ ["arg1", ... , "argN"] ], ["name"])
			if ( i = cache[cache_name = (str + $tab + args)] )
				return namecache[name] = i;
			
			var	compiled,
					namespace = {
						// Storage for replacements
						$r	:	[],
						// Global template Id, may be used by plugins
						$gid: gid++
					},
					local,
					// Index
					i,
					// Args converted to string
					// Need them for caching
					cache_name,
					// Var count
					varcount = 0;							
					
			// Add $_ to scope
			// And check that args is array
			( args instanceof Array) ? (args[ args.length ]="$_") : (args = ["$_"]);
						
			// Preprocess template				
			// Go through each row
			// And replace it with code
			compiled = str ? map(
				str
					.replace($tabs , " ")
						.replace($brackets , $tab)
							.split($tab),
				function ( elem, i) {
			
					if (i%2) {
						// Code
					
						// If there is modificator
						( (i = elem.match($modificator)) && ( i.f = modificators[ i[1] ]) ) &&
							// Use it to translate elem
							(
								elem = i.f(elem.substr(i[0].length), namespace)
							);
						
							return elem;
					}
					
					// Text
					if (!elem)
						return "";
						
					// Push text into namespace as $(var number)
					namespace[ (args[ args.length ] = "$" + varcount) ] = elem;
					
					// So, instead of inline printing we will print variable
					return "$p($" + ( varcount++ ) + ",$_);";				
					
							
				}
			// Then join all rows
			).join("") : "";
			
	
			// Create function with overdriven args
			// In secure closure
			// Fixed: IE was throwing error I is undefined, so returned to array evaluation
			i = $eval("[function($scope,$args,$p," + args.join(",") + "){$_=[];" + compiled + ";return $_.join('')}]");						
			
			/**
			* Generate arguments array that will be passed to template function
			* @param {array} args Default arguments that was passed on creation
			* @param {object} callArgs Arguments that will be used now
			* @return {array}
			*/
			function createArguments(callArgs,result,i) {
				
				// Store local copy of $r (replacement array)
				var $r = namespace.$r;
				
				/** There're some predefined arguments such as:
				* $scope = namespace,
				* $args = callArgs,
				* $p = function
				*
				* $p is pushing function, declared here to have access to $r variable
				*/
				result = [ namespace, callArgs , function (a,$_) {
					
					// Push string or object into global output stack
					return $_[$_.length] = a;					
							
				} ];
				
				for (i in args)					
					result[ result.length ] = callArgs[ args[i] ];
				
				return result;
				
			}
			
			
			/**
			*	And cache it wrapper, that will recreate scope and call original function
			*	@param {object} args arguments to pass
			*	@return {string}
			*/
			local = cache[cache_name] = function (callArgs) {
				// Args can be null
				callArgs = callArgs || {};
		
				// Extend callArgs with namespace
				for ( name in namespace )
					callArgs[name] = namespace[name];
	
				// Attach permament scope to namespace	
				
				// Return result of execution				
				return i.apply(undefined , createArguments( callArgs ));
			}
			
			// If name is defined
			name &&
				// Add to name cache
				(namecache[name] = local);
			
			// Return wrapper
			return local;
		}
		
		/**
		* Render template, getting it from object
		* If name is defined - store into namecache
		* Also you can use this syntax:
		* $('...').render({arguments});
		* $('...').render("name");
		* @param {string|object} name Template name or arguments
		* @return {object}
		*/
		$.render = function (id , name, args,fn, $this) {
		
			$this = document.getElementById(id);
			// We can call template without name
			(!args) &&
				(typeof name !== "string") &&
					(args = name) &&
						(name = undefined);
					
			fn = $.template(
				// Code of element = template
				$this.innerHTML,
				// Variables = classes
				($this[0]&&($this = $this.className)) ? $this.split($spaces) : [],
				name
			);
			
			// If we have arguments - generate object
			// Else return jQuery
			return args ? fn(args): $;
		}
		
		// Imported from jQuery
		$.each = function ( object, callback, context ) {
			var name, i = 0, length = object.length;

			if ( length === undefined ) {
				for ( name in object ) {
					if ( !name || object[ name ] === undefined || !object.hasOwnProperty(name) ) continue;
					if ( callback.call( context || object[ name ], name, object[ name ] ) === false ) { break; }
				}
			} else {
				for ( var value = object[0]; i < length && callback.call( context || value, i, value ) !== false; value = object[++i] ){}
			}
			return object;
		}
		
		$.trim = function (text) {
			return (text || "").replace( rtrim, "" );
		}
		
		// Add modificators to $.template
		$.modificators = modificators;
				
		// Constants and cache
	})( "\t" ,  0 ,
	     {} , {} , /{%|%}/g , /^([^\s]+)(?:\s|$)/ ,
		 /\t/g , /\s+/g , /%1/, /^(\s|\u00A0)+|(\s|\u00A0)+$/g);
	
	
	return $;
})();/**@preserve jsTPL v.0.0.1;Copyright 2010, Fedor Indutny;Released under MIT license;Parts of code derived from jQuery JavaScript Library;Copyright (c) 2009 John Resig **/
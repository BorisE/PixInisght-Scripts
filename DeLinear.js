/*

DeLinear.js: Transform linear image to a non-linear form
================================================================================

Die Transformation vom linearen auf das gestreckte Bild ist mit wenigen
Handgriffen über die ScreenTransferFunction und einer nachfolgenden
HistogramTransformation zu machen. Das Script erledigt das in einem Vorgang.

A simple script to transform the active linear image into a non-linear form.
This script makes the following steps:

    * STF with separate channels
    * STF appliance to the HistogramTransformation process
    * STF disable
    * Histogram appliance to the view

================================================================================
 *
 * Copyright (C) 2016, Hartmut V. Bornemann
 *
 * 24.11.2017 changed to version 2.0.0
 * function ApplyAutoSTF taken from the AutoSTF script
 */

#feature-id    Utilities2 > DeLinear
#define VERSION "2.0.1"

#feature-info  A script that transforms a linear image into a non-linear (streched) form.<br/>\
   Copyright (C) 2016, Hartmut V. Bornemann

#include <pjsr/UndoFlag.jsh>

// Shadows clipping point in (normalized) MAD units from the median.
#define DEFAULT_AUTOSTRETCH_SCLIP  -2.80
// Target mean background in the [0,1] range.
#define DEFAULT_AUTOSTRETCH_TBGND   0.25

#define test 0

function main()
{
   // Get access to the current active image window.
   var window = ImageWindow.activeWindow;
   if ( window.isNull )
      throw new Error( "No active image" );

   Console.show();
   Console.writeln( "<end><cbr><br><b>De-linearize " + window.currentView.fullId + "</b>" );
   Console.flush();

   var currentView = ImageWindow.activeWindow.currentView;

   ApplyAutoSTF( currentView,
                 DEFAULT_AUTOSTRETCH_SCLIP,
                 DEFAULT_AUTOSTRETCH_TBGND,
                 true );

   var stf = currentView.stf;
	var c0 = stf[0][1];
	var m  = stf[0][0];

   var H = [[  0, 0.5, 1.0, 0, 1.0],
            [  0, 0.5, 1.0, 0, 1.0],
            [  0, 0.5, 1.0, 0, 1.0],
            [ c0,   m, 1.0, 0, 1.0],
            [  0, 0.5, 1.0, 0, 1.0]];

   var STF = new ScreenTransferFunction;
	STF.interaction = ScreenTransferFunction.prototype.SeparateChannels;
   currentView.stf =  [ // c0, c1, m, r0, r1
		[m, 1.00000,  c0, 0.0, 1.0],
		[m, 1.00000,  c0, 0.0, 1.0],
		[m, 1.00000,  c0, 0.0, 1.0],
		[0, 1.00000, 0.5, 0.0, 1.0]
   ];

   STF.executeOn(currentView)
   printArray(H);
	var HT = new HistogramTransformation;
 	HT.H = H;

   if ( HT.executeOn(currentView) )
   {
   	ApplyAutoSTF( currentView,
						  DEFAULT_AUTOSTRETCH_SCLIP,
						  DEFAULT_AUTOSTRETCH_TBGND,
						  true );

   	Console.writeln( "De-Linearize end" );
	}
	else
		Console.writeln( "De-Linearize failed" );

}

function printArray(a)
{
	if (test)
	{
		for (var i = 0; i < a.length; i++)
		{
			var b = a[i];
			Console.write("[" + i + "]  ");
			for (var j = 0; j < b.length; j++)
			{
				Console.write(format("  %.6f", b[j]));
			}
			Console.writeln();
		}
	}
}

/*
 * STF Auto Stretch routine
 */
function ApplyAutoSTF( view, shadowsClipping, targetBackground, rgbLinked )
{
   var stf = new ScreenTransferFunction;

   var n = view.image.isColor ? 3 : 1;

   var median = view.computeOrFetchProperty( "Median" );

   var mad = view.computeOrFetchProperty( "MAD" );
   mad.mul( 1.4826 ); // coherent with a normal distribution

   if ( rgbLinked )
   {
      /*
       * Try to find how many channels look as channels of an inverted image.
       * We know a channel has been inverted because the main histogram peak is
       * located over the right-hand half of the histogram. Seems simplistic
       * but this is consistent with astronomical images.
       */
      var invertedChannels = 0;
      for ( var c = 0; c < n; ++c )
         if ( median.at( c ) > 0.5 )
            ++invertedChannels;

      if ( invertedChannels < n )
      {
         /*
          * Noninverted image
          */
         var c0 = 0, m = 0;
         for ( var c = 0; c < n; ++c )
         {
            if ( 1 + mad.at( c ) != 1 )
               c0 += median.at( c ) + shadowsClipping * mad.at( c );
            m  += median.at( c );
         }
         c0 = Math.range( c0/n, 0.0, 1.0 );
         m = Math.mtf( targetBackground, m/n - c0 );

         stf.STF = [ // c0, c1, m, r0, r1
                     [c0, 1, m, 0, 1],
                     [c0, 1, m, 0, 1],
                     [c0, 1, m, 0, 1],
                     [0, 1, 0.5, 0, 1] ];
      }
      else
      {
         /*
          * Inverted image
          */
         var c1 = 0, m = 0;
         for ( var c = 0; c < n; ++c )
         {
            m  += median.at( c );
            if ( 1 + mad.at( c ) != 1 )
               c1 += median.at( c ) - shadowsClipping * mad.at( c );
            else
               c1 += 1;
         }
         c1 = Math.range( c1/n, 0.0, 1.0 );
         m = Math.mtf( c1 - m/n, targetBackground );

         stf.STF = [ // c0, c1, m, r0, r1
                     [0, c1, m, 0, 1],
                     [0, c1, m, 0, 1],
                     [0, c1, m, 0, 1],
                     [0, 1, 0.5, 0, 1] ];
      }
   }
   else
   {
      /*
       * Unlinked RGB channnels: Compute automatic stretch functions for
       * individual RGB channels separately.
       */
      var A = [ // c0, c1, m, r0, r1
               [0, 1, 0.5, 0, 1],
               [0, 1, 0.5, 0, 1],
               [0, 1, 0.5, 0, 1],
               [0, 1, 0.5, 0, 1] ];

      for ( var c = 0; c < n; ++c )
      {
         if ( median.at( c ) < 0.5 )
         {
            /*
             * Noninverted channel
             */
            var c0 = (1 + mad.at( c ) != 1) ? Math.range( median.at( c ) + shadowsClipping * mad.at( c ), 0.0, 1.0 ) : 0.0;
            var m  = Math.mtf( targetBackground, median.at( c ) - c0 );
            A[c] = [c0, 1, m, 0, 1];
         }
         else
         {
            /*
             * Inverted channel
             */
            var c1 = (1 + mad.at( c ) != 1) ? Math.range( median.at( c ) - shadowsClipping * mad.at( c ), 0.0, 1.0 ) : 1.0;
            var m  = Math.mtf( c1 - median.at( c ), targetBackground );
            A[c] = [0, c1, m, 0, 1];
         }
      }

      stf.STF = A;
   }

	if (test)
	{
		Console.writeln("ApplyAutoSTF:");
		printArray(stf.STF);

		console.writeln( "<end><cbr/><br/><b>", view.fullId, "</b>:" );
		for ( var c = 0; c < n; ++c )
		{
			console.writeln( "channel #", c );
			console.writeln( format( "c0 = %.6f", stf.STF[c][0] ) );
			console.writeln( format( "m  = %.6f", stf.STF[c][2] ) );
			console.writeln( format( "c1 = %.6f", stf.STF[c][1] ) );
		}
	}

   stf.executeOn( view );

   if (test) console.writeln( "<end><cbr/><br/>" );
}


main();

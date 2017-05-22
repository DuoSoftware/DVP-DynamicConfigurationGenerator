/**
 * Created by dinusha on 5/22/2017.
 */

var LimitValidator = function(limitInfo, trunkNumber, direction)
{
    var numInbLim = null;
    var numOutLim = null;
    var numBothLim = null;
    var compInbLim = null;
    var compOutLim = null;
    var compBothLim = null;

    if(direction === 'inbound')
    {
        if((limitInfo.NumberInboundLimit && limitInfo.NumberInboundLimit.Enable && typeof limitInfo.NumberInboundLimit.MaxCount != 'undefined') || (limitInfo.NumberBothLimit && limitInfo.NumberBothLimit.Enable && typeof limitInfo.NumberBothLimit.MaxCount != 'undefined')
            || (limitInfo.CompanyInboundLimit && limitInfo.CompanyInboundLimit.Enable && typeof limitInfo.CompanyInboundLimit.MaxCount != 'undefined') || (limitInfo.CompanyBothLimit && limitInfo.CompanyBothLimit.Enable && typeof limitInfo.CompanyBothLimit.MaxCount != 'undefined'))
        {
            if(limitInfo.NumberInboundLimit)
            {
                numInbLim = limitInfo.NumberInboundLimit.MaxCount;
            }

            if(limitInfo.NumberBothLimit)
            {
                numBothLim = limitInfo.NumberBothLimit.MaxCount;
            }

            if(limitInfo.CompanyInboundLimit)
            {
                compInbLim = limitInfo.CompanyInboundLimit.MaxCount;
            }

            if(limitInfo.CompanyBothLimitt)
            {
                compBothLim = limitInfo.CompanyBothLimit.MaxCount;
            }

            return {
                NumberInboundLimit: numInbLim,
                NumberOutboundLimit: numOutLim,
                NumberBothLimit: numBothLim,
                CompanyInboundLimit: compInbLim,
                CompanyOutboundLimit: compOutLim,
                CompanyBothLimit: compBothLim,
                TrunkNumber: trunkNumber
            };

        }
        else
        {
            return null;
        }
    }
    else if(direction === 'outbound')
    {
        if((limitInfo.NumberOutboundLimit && limitInfo.NumberOutboundLimit.Enable && typeof limitInfo.NumberOutboundLimit.MaxCount != 'undefined') || (limitInfo.NumberBothLimit && limitInfo.NumberBothLimit.Enable && typeof limitInfo.NumberBothLimit.MaxCount != 'undefined')
            || (limitInfo.CompanyOutboundLimit && limitInfo.CompanyOutboundLimit.Enable && typeof limitInfo.CompanyOutboundLimit.MaxCount != 'undefined') || (limitInfo.CompanyBothLimit && limitInfo.CompanyBothLimit.Enable && typeof limitInfo.CompanyBothLimit.MaxCount != 'undefined'))
        {
            if(limitInfo.NumberOutboundLimit)
            {
                numOutLim = limitInfo.NumberOutboundLimit.MaxCount;
            }

            if(limitInfo.NumberBothLimit)
            {
                numBothLim = limitInfo.NumberBothLimit.MaxCount;
            }

            if(limitInfo.CompanyOutboundLimit)
            {
                compOutLim = limitInfo.CompanyOutboundLimit.MaxCount;
            }

            if(limitInfo.CompanyBothLimitt)
            {
                compBothLim = limitInfo.CompanyBothLimit.MaxCount;
            }

            return {
                NumberInboundLimit: numInbLim,
                NumberOutboundLimit: numOutLim,
                NumberBothLimit: numBothLim,
                CompanyInboundLimit: compInbLim,
                CompanyOutboundLimit: compOutLim,
                CompanyBothLimit: compBothLim,
                TrunkNumber: trunkNumber
            };

        }
        else
        {
            return null;
        }
    }
    else
    {
        return null;
    }

};

module.exports.LimitValidator = LimitValidator;